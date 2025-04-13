import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  AppLayout,
  Box,
  Button,
  Container,
  Header,
  Select,
  SpaceBetween,
  Input,
  DatePicker,
  ExpandableSection
} from '@cloudscape-design/components';
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from '@aws-sdk/client-athena';

import filtersConfig from './filtersConfig';

const athena = new AthenaClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
  },
});

const waitForQuery = async (executionId) => {
  while (true) {
    const { QueryExecution } = await athena.send(new GetQueryExecutionCommand({ QueryExecutionId: executionId }));
    const state = QueryExecution.Status.State;
    if (state === 'SUCCEEDED') return;
    if (state === 'FAILED' || state === 'CANCELLED') throw new Error(`Query ${state}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
};

const getQueryResults = async (executionId) => {
  const { ResultSet } = await athena.send(new GetQueryResultsCommand({ QueryExecutionId: executionId }));
  const [header, ...rows] = ResultSet.Rows;
  const headers = header.Data.map((d) => d.VarCharValue);
  return rows.map((row) => {
    const values = row.Data.map((d) => d.VarCharValue || '');
    return Object.fromEntries(values.map((v, i) => [headers[i], v]));
  });
};

const athenaService = async (query, boxId) => {
  console.log(`[SQL for ${boxId}] → ${query}`);
  const start = await athena.send(
    new StartQueryExecutionCommand({
      QueryString: query,
      QueryExecutionContext: { Database: 'your_athena_db' },
      ResultConfiguration: {
        OutputLocation: 's3://your-athena-results-bucket/',
      },
    })
  );
  await waitForQuery(start.QueryExecutionId);
  return await getQueryResults(start.QueryExecutionId);
};

const FilterContext = createContext();
const useFilters = () => useContext(FilterContext);

const queryBuilder = (baseSQL, filters) => {
  let query = baseSQL;
  const clauses = [];

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || value === 'All' || value.length === 0) return;
    if (Array.isArray(value)) {
      const filtered = value.filter((v) => v !== 'All');
      if (filtered.length > 0) {
        clauses.push(`${key} IN (${filtered.map((v) => `'${v}'`).join(', ')})`);
      }
    } else {
      clauses.push(`${key} = '${value}'`);
    }
  });

  if (clauses.length) {
    query += baseSQL.toLowerCase().includes('where') ? ' AND ' : ' WHERE ';
    query += clauses.join(' AND ');
  }

  return query;
};

const dashboardConfig = [
  {
    id: 'revenue_kpi',
    title: 'Revenue',
    baseSQL: 'SELECT label, value FROM revenue_summary LIMIT 1',
    parseResponse: (raw) => {
      const item = raw[0] || {};
      return { title: 'Revenue', value: item.value, label: item.label };
    },
    component: 'RevenueCard'
  },
  {
    id: 'headcount_table',
    title: 'Headcount Table',
    baseSQL: 'SELECT * FROM headcount',
    frontendPagination: true,
    pageSize: 10,
    parseResponse: (raw) => {
      const headers = Object.keys(raw[0] || {});
      return { headers, rows: raw };
    },
    component: 'HeadcountTable'
  },
];

const RevenueCard = ({ parsed }) => (
  <Box>
    <h3>{parsed?.title || 'N/A'}</h3>
    <p style={{ fontSize: 22 }}>{parsed?.value || '--'}</p>
    <small>{parsed?.label}</small>
  </Box>
);

const HeadcountTable = ({ parsed }) => {
  if (!parsed?.headers?.length) return <Box>No Data</Box>;
  return (
    <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }} border="1" cellPadding={4}>
        <thead>
          <tr>{parsed.headers.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {parsed.rows.map((row, i) => (
            <tr key={i}>
              {parsed.headers.map((h) => <td key={h}>{row[h]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const FilterControls = ({ onApply }) => {
  const { tempFilters, setTempFilters } = useFilters();
  const handleChange = (key, value) => {
    setTempFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Container header={<Header variant="h3">Controls</Header>}>
      <SpaceBetween size="m">
        {filtersConfig.map(({ key, label, type, options, placeholder }) => (
          <div key={key}>
            <Box variant="awsui-key-label">{label}</Box>
            {type === 'multi-select' || type === 'select' ? (
              <Select
                selectedOption={{ label: tempFilters[key] || 'All', value: tempFilters[key] || 'All' }}
                onChange={({ detail }) => handleChange(key, detail.selectedOption.value)}
                options={options.map((opt) => ({ label: opt, value: opt }))}
              />
            ) : type === 'text' ? (
              <Input
                value={tempFilters[key] || ''}
                onChange={({ detail }) => handleChange(key, detail.value)}
                placeholder={placeholder}
              />
            ) : type === 'date' ? (
              <DatePicker
                value={tempFilters[key] || ''}
                onChange={({ detail }) => handleChange(key, detail.value)}
              />
            ) : null}
          </div>
        ))}
        <Button variant="primary" onClick={onApply}>Apply Filters</Button>
      </SpaceBetween>
    </Container>
  );
};

const Dashboard = () => {
  const { filters, tempFilters, setFilters } = useFilters();
  const [dataMap, setDataMap] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [trigger, setTrigger] = useState(0);

  const applyFilters = () => {
    setFilters(tempFilters);
    setTrigger((t) => t + 1);
  };

  useEffect(() => {
    if (!filters) return;
    dashboardConfig.forEach(async (cfg) => {
      setLoadingMap((prev) => ({ ...prev, [cfg.id]: true }));
      try {
        const query = queryBuilder(cfg.baseSQL, filters);
        const raw = await athenaService(query, cfg.id);
        const parsed = cfg.parseResponse(raw);
        setDataMap((prev) => ({ ...prev, [cfg.id]: parsed }));
      } catch (err) {
        console.error(err);
        setDataMap((prev) => ({ ...prev, [cfg.id]: null }));
      } finally {
        setLoadingMap((prev) => ({ ...prev, [cfg.id]: false }));
      }
    });
  }, [trigger]);

  const componentMap = {
    RevenueCard,
    HeadcountTable,
  };

  return (
    <AppLayout
      content={
        <SpaceBetween size="l" direction="vertical" className="p-4">
          <FilterControls onApply={applyFilters} />
          {dashboardConfig.map((cfg) => {
            const Component = componentMap[cfg.component];
            const data = dataMap[cfg.id];
            const loading = loadingMap[cfg.id];
            return (
              <ExpandableSection key={cfg.id} headerText={cfg.title} defaultExpanded>
                <Container>
                  {loading ? <Box>Loading...</Box> : <Component parsed={data} />}
                </Container>
              </ExpandableSection>
            );
          })}
        </SpaceBetween>
      }
    />
  );
};

const App = () => {
  const [filters, setFilters] = useState({});
  const [tempFilters, setTempFilters] = useState({});

  return (
    <FilterContext.Provider value={{ filters, setFilters, tempFilters, setTempFilters }}>
      <Dashboard />
    </FilterContext.Provider>
  );
};

export default App;
