import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from '@aws-sdk/client-athena';

import filtersConfig from './filtersConfig';

// ------------------- AWS Athena Setup -------------------
const athena = new AthenaClient({
  region: 'us-east-1',
  credentials: ({
    accessKeyId: 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
  }),
});

const waitForQuery = async (executionId) => {
  while (true) {
    const { QueryExecution } = await athena.send(
      new GetQueryExecutionCommand({ QueryExecutionId: executionId })
    );
    const state = QueryExecution.Status.State;
    if (state === 'SUCCEEDED') return;
    if (state === 'FAILED' || state === 'CANCELLED') throw new Error(`Query ${state}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
};

const getQueryResults = async (executionId) => {
  const { ResultSet } = await athena.send(
    new GetQueryResultsCommand({ QueryExecutionId: executionId })
  );
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

// ------------------- Context -------------------
const FilterContext = createContext();
const useFilters = () => useContext(FilterContext);

// ------------------- Query Builder -------------------
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

// ------------------- Dashboard Config -------------------
const dashboardConfig = [
  {
    id: 'revenue_kpi',
    title: 'Revenue',
    baseSQL: 'SELECT label, value FROM revenue_summary LIMIT 1',
    parseResponse: (raw) => {
      const item = raw[0] || {};
      return { title: 'Revenue', value: item.value, label: item.label };
    },
    Renderer: ({ parsed }) => (
      <div style={{ padding: 16, border: '1px solid #ddd', marginBottom: 16 }}>
        <h3>{parsed?.title || 'N/A'}</h3>
        <p style={{ fontSize: 22 }}>{parsed?.value || '--'}</p>
        <small>{parsed?.label}</small>
      </div>
    ),
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
    Renderer: ({ parsed, currentPage, onPageChange, pageSize }) => {
      if (!parsed?.headers?.length) return <div>No Data</div>;

      const paginatedRows = parsed.rows.slice(
        currentPage * pageSize,
        (currentPage + 1) * pageSize
      );

      return (
        <div>
          <div
            style={{
              overflowY: 'auto',
              maxHeight: '400px',
              border: '1px solid #ddd',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }} border="1" cellPadding={4}>
              <thead>
                <tr>{parsed.headers.map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, i) => (
                  <tr key={i}>
                    {parsed.headers.map((h) => <td key={h}>{row[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 0}>
              Prev
            </button>
            <span style={{ margin: '0 12px' }}>Page {currentPage + 1}</span>
            <button onClick={() => onPageChange(currentPage + 1)}>
              Next
            </button>
          </div>
        </div>
      );
    },
  },
];

// ------------------- Sidebar -------------------
const Sidebar = ({ onApply }) => {
  const { tempFilters, setTempFilters } = useFilters();

  const handleChange = (key, value) => {
    setTempFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ width: 260, padding: 16, borderRight: '1px solid #ccc' }}>
      <h3>Filters</h3>
      {filtersConfig.map(({ key, label, type, options, placeholder }) => (
        <div key={key}>
          <label>{label}</label>
          {type === 'multi-select' ? (
            <select
              value={tempFilters[key] || 'All'}
              onChange={(e) => handleChange(key, [e.target.value])}
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : type === 'text' ? (
            <input
              type="text"
              placeholder={placeholder}
              value={tempFilters[key] || ''}
              onChange={(e) => handleChange(key, e.target.value)}
            />
          ) : type === 'date' ? (
            <input
              type="date"
              value={tempFilters[key] || ''}
              onChange={(e) => handleChange(key, e.target.value)}
            />
          ) : null}
        </div>
      ))}
      <button onClick={onApply} style={{ marginTop: 12 }}>
        Apply Filters
      </button>
    </div>
  );
};

// ------------------- Dashboard -------------------
const Dashboard = () => {
  const { filters, tempFilters, setFilters } = useFilters();
  const [dataMap, setDataMap] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [trigger, setTrigger] = useState(0);
  const [paginationMap, setPaginationMap] = useState({});

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
        setPaginationMap((prev) => ({ ...prev, [cfg.id]: 0 }));
      } catch (err) {
        console.error(err);
        setDataMap((prev) => ({ ...prev, [cfg.id]: null }));
      } finally {
        setLoadingMap((prev) => ({ ...prev, [cfg.id]: false }));
      }
    });
  }, [trigger]);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar onApply={applyFilters} />
      <div style={{ flex: 1, padding: 16 }}>
        {dashboardConfig.map((cfg) => {
          const Renderer = cfg.Renderer;
          const data = dataMap[cfg.id];
          const loading = loadingMap[cfg.id];
          const currentPage = paginationMap[cfg.id] || 0;

          const handlePageChange = (newPage) => {
            if (newPage < 0) return;
            setPaginationMap((prev) => ({ ...prev, [cfg.id]: newPage }));
          };

          return (
            <div key={cfg.id} style={{ width: '100%', marginBottom: 32 }}>
              <h3>{cfg.title}</h3>
              {loading ? (
                <div>Loading...</div>
              ) : (
                <Renderer
                  parsed={data}
                  {...(cfg.frontendPagination && {
                    currentPage,
                    onPageChange: handlePageChange,
                    pageSize: cfg.pageSize,
                  })}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------- App -------------------
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
