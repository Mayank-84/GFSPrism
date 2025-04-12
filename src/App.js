import React, { useState, useEffect, createContext, useContext } from 'react';
import AWS from 'aws-sdk';

// ------------------ AWS Athena Setup (Hardcoded creds for testing) ------------------
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'YOUR_AWS_ACCESS_KEY_ID',
  secretAccessKey: 'YOUR_AWS_SECRET_ACCESS_KEY',
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

// ------------------ Context ------------------
const FilterContext = createContext();
const useFilters = () => useContext(FilterContext);

// ------------------ UI Components ------------------
const KPIBox = ({ parsed }) => {
  if (!parsed) return <div>No KPI Data</div>;
  return (
    <div style={{ flex: 1, padding: 16, border: '1px solid #ddd' }}>
      <h3>{parsed.title}</h3>
      <p style={{ fontSize: 22, fontWeight: 'bold' }}>{parsed.value}</p>
      <small>{parsed.label}</small>
    </div>
  );
};

const TableBox = ({ parsed }) => {
  if (!parsed || !parsed.headers?.length) return <div>No Table Data</div>;
  return (
    <div style={{ flex: 2, padding: 16, border: '1px solid #ddd' }}>
      <h3>Table</h3>
      <table border="1" cellPadding={4}>
        <thead>
          <tr>
            {parsed.headers.map((h) => <th key={h}>{h}</th>)}
          </tr>
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

const GraphBox = ({ parsed }) => {
  if (!parsed?.points?.length) return <div>No Graph Data</div>;
  return (
    <div style={{ flex: 2, padding: 16, border: '1px solid #ddd' }}>
      <h3>Graph</h3>
      <pre>{JSON.stringify(parsed.points, null, 2)}</pre>
    </div>
  );
};

// ------------------ Dashboard Config ------------------
const dashboardConfig = [
  {
    id: 'revenue_kpi',
    title: 'Revenue',
    baseSQL: 'SELECT label, value FROM revenue_summary LIMIT 1',
    parseResponse: (raw) => {
      const item = raw[0] || {};
      return { title: 'Revenue', value: item.value, label: item.label };
    },
    Renderer: KPIBox,
  },
  {
    id: 'employee_table',
    title: 'Employee Table',
    baseSQL: 'SELECT name, department FROM employee_data LIMIT 10',
    parseResponse: (raw) => {
      const headers = Object.keys(raw[0] || {});
      return { headers, rows: raw };
    },
    Renderer: TableBox,
  },
  {
    id: 'headcount_graph',
    title: 'Headcount Trend',
    baseSQL: 'SELECT date, count FROM headcount ORDER BY date ASC',
    parseResponse: (raw) => ({ points: raw }),
    Renderer: GraphBox,
  },
];

// ------------------ Query Builder ------------------
const queryBuilder = (baseSQL, filters) => {
  let query = baseSQL;
  if (filters.dateRange) {
    query += ` AND date_range = '${filters.dateRange}'`;
  }
  if (filters.category && filters.category !== 'All') {
    query += ` AND category = '${filters.category}'`;
  }
  return query;
};

// ------------------ Sidebar ------------------
const Sidebar = ({ onApply }) => {
  const { filters, setFilters } = useFilters();

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div style={{ width: 200, padding: 16, borderRight: '1px solid #ccc' }}>
      <h3>Filters</h3>
      <label>Date Range:</label>
      <select name="dateRange" value={filters.dateRange} onChange={handleChange}>
        <option value="last_7_days">Last 7 Days</option>
        <option value="last_30_days">Last 30 Days</option>
      </select>

      <br />
      <label>Category:</label>
      <select name="category" value={filters.category} onChange={handleChange}>
        <option value="All">All</option>
        <option value="Engineering">Engineering</option>
        <option value="HR">HR</option>
      </select>

      <br />
      <button onClick={onApply} style={{ marginTop: 12 }}>Apply Filters</button>
    </div>
  );
};

// ------------------ Dashboard ------------------
const Dashboard = () => {
  const { filters } = useFilters();
  const [trigger, setTrigger] = useState(0);
  const [dataMap, setDataMap] = useState({});
  const [loadingMap, setLoadingMap] = useState({});

  const applyFilters = () => setTrigger((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const newLoading = {};
      dashboardConfig.forEach((cfg) => (newLoading[cfg.id] = true));
      setLoadingMap(newLoading);

      const results = await Promise.all(
        dashboardConfig.map(async (cfg) => {
          try {
            const query = queryBuilder(cfg.baseSQL, filters);
            const raw = await athenaService(query, cfg.id);
            const parsed = cfg.parseResponse(raw);
            return { id: cfg.id, parsed };
          } catch (e) {
            console.error(`Error loading ${cfg.id}:`, e);
            return { id: cfg.id, parsed: null };
          }
        })
      );

      if (!cancelled) {
        const map = {};
        results.forEach((r) => (map[r.id] = r.parsed));
        setDataMap(map);
        setLoadingMap({});
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [trigger, filters]);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar onApply={applyFilters} />
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16 }}>
        {dashboardConfig.map((cfg) => {
          const Renderer = cfg.Renderer;
          const data = dataMap[cfg.id];
          const loading = loadingMap[cfg.id];

          return (
            <div key={cfg.id} style={{ flex: 1, minWidth: 300 }}>
              {loading ? (
                <div style={{ padding: 16 }}>Loading {cfg.title}...</div>
              ) : data ? (
                <Renderer parsed={data} />
              ) : (
                <div style={{ padding: 16, color: 'red' }}>No data for {cfg.title}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------ App Root ------------------
const App = () => {
  const [filters, setFilters] = useState({
    dateRange: 'last_7_days',
    category: 'All',
  });

  return (
    <FilterContext.Provider value={{ filters, setFilters }}>
      <Dashboard />
    </FilterContext.Provider>
  );
};

export default App;
