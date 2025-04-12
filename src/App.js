import React, { useState, useEffect, createContext, useContext } from 'react';
import AWS from 'aws-sdk';
import filtersConfig from './filtersConfig';

// ---------- AWS Athena (dev only: do not hardcode in production) ----------
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'YOUR_ACCESS_KEY_ID',
  secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
});

const athena = new AWS.Athena();

const waitForQuery = async (QueryExecutionId) => {
  while (true) {
    const res = await athena.getQueryExecution({ QueryExecutionId }).promise();
    const state = res.QueryExecution.Status.State;
    if (state === 'SUCCEEDED') return;
    if (['FAILED', 'CANCELLED'].includes(state)) throw new Error(`Athena query failed: ${state}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
};

const getQueryResults = async (QueryExecutionId) => {
  const res = await athena.getQueryResults({ QueryExecutionId }).promise();
  const [header, ...rows] = res.ResultSet.Rows;
  const headers = header.Data.map((d) => d.VarCharValue);
  return rows.map((row) => {
    const values = row.Data.map((d) => d.VarCharValue || '');
    return Object.fromEntries(values.map((v, i) => [headers[i], v]));
  });
};

const athenaService = async (query, boxId) => {
  console.log(`[SQL for ${boxId}]: ${query}`);
  const start = await athena.startQueryExecution({
    QueryString: query,
    QueryExecutionContext: { Database: 'your_athena_db' },
    ResultConfiguration: {
      OutputLocation: 's3://your-athena-results-bucket/',
    },
  }).promise();

  await waitForQuery(start.QueryExecutionId);
  return await getQueryResults(start.QueryExecutionId);
};

// ---------- Context ----------
const FilterContext = createContext();
const useFilters = () => useContext(FilterContext);

// ---------- Query Builder ----------
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

// ---------- Dashboard Config ----------
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
      <div style={{ padding: 16, border: '1px solid #ddd' }}>
        <h3>{parsed?.title || 'N/A'}</h3>
        <p style={{ fontSize: 22 }}>{parsed?.value || '--'}</p>
        <small>{parsed?.label}</small>
      </div>
    ),
  },
  {
    id: 'employee_table',
    title: 'Employee Table',
    baseSQL: 'SELECT name, department FROM employee_data LIMIT 10',
    parseResponse: (raw) => {
      const headers = Object.keys(raw[0] || {});
      return { headers, rows: raw };
    },
    Renderer: ({ parsed }) =>
      !parsed?.headers?.length ? (
        <div>No data</div>
      ) : (
        <table border="1" cellPadding={4}>
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
      ),
  },
  {
    id: 'headcount_graph',
    title: 'Headcount Trend',
    baseSQL: 'SELECT date, count FROM headcount ORDER BY date ASC',
    parseResponse: (raw) => ({ points: raw }),
    Renderer: ({ parsed }) =>
      !parsed?.points?.length ? (
        <div>No graph data</div>
      ) : (
        <pre>{JSON.stringify(parsed.points, null, 2)}</pre>
      ),
  },
];

// ---------- Sidebar ----------
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
      <button onClick={onApply} style={{ marginTop: 12 }}>Apply Filters</button>
    </div>
  );
};

// ---------- Dashboard ----------
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

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar onApply={applyFilters} />
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16 }}>
        {dashboardConfig.map((cfg) => {
          const Renderer = cfg.Renderer;
          const loading = loadingMap[cfg.id];
          const data = dataMap[cfg.id];

          return (
            <div key={cfg.id} style={{ flex: 1, minWidth: 300 }}>
              <h3>{cfg.title}</h3>
              {loading ? <div>Loading...</div> : <Renderer parsed={data} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- App ----------
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
