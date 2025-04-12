import React, { createContext, useContext, useState, useEffect } from 'react';

// ------------------ Filter Context ------------------
const FilterContext = createContext();

const FilterProvider = ({ children }) => {
  const [filters, setFilters] = useState({
    dateRange: 'last_7_days',
    category: 'All',
  });

  return (
    <FilterContext.Provider value={{ filters, setFilters }}>
      {children}
    </FilterContext.Provider>
  );
};

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
            {parsed.headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsed.rows.map((row, i) => (
            <tr key={i}>
              {parsed.headers.map((h) => (
                <td key={h}>{row[h]}</td>
              ))}
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
    baseSQL: 'SELECT * FROM revenue',
    parseResponse: (raw) => {
      const item = raw[0] || {};
      return { title: 'Revenue', value: item.value, label: item.label };
    },
    Renderer: KPIBox,
  },
  {
    id: 'growth_kpi',
    title: 'Growth',
    baseSQL: 'SELECT * FROM growth',
    parseResponse: (raw) => {
      const item = raw[0] || {};
      return { title: 'Growth', value: item.value, label: item.label };
    },
    Renderer: KPIBox,
  },
  {
    id: 'employee_table',
    title: 'Employee Table',
    baseSQL: 'SELECT * FROM employee_data',
    parseResponse: (raw) => {
      const headers = Object.keys(raw[0] || {});
      return { headers, rows: raw };
    },
    Renderer: TableBox,
  },
  {
    id: 'headcount_graph',
    title: 'Headcount Trend',
    baseSQL: 'SELECT * FROM headcount_timeseries',
    parseResponse: (raw) => ({ points: raw }),
    Renderer: GraphBox,
  },
];

// ------------------ Athena Service ------------------

const athenaService = async (query, boxId) => {
  console.log(`Executing Athena Query for ${boxId}:`, query);
  await new Promise((res) => setTimeout(res, Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000)); // 3s delay

  const mockData = {
    revenue_kpi: [{ label: 'This Month', value: '$10,000' }],
    growth_kpi: [{ label: 'YoY Growth', value: '15%' }],
    employee_table: [
      { name: 'Alice', department: 'Engineering' },
      { name: 'Bob', department: 'HR' },
    ],
    headcount_graph: [
      { date: '2024-01-01', count: 10 },
      { date: '2024-02-01', count: 15 },
      { date: '2024-03-01', count: 18 },
    ],
  };

  return mockData[boxId] || [];
};

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

  const applyFilters = () => setTrigger((prev) => prev + 1);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      const loadingState = {};
      dashboardConfig.forEach((cfg) => (loadingState[cfg.id] = true));
      setLoadingMap(loadingState);

      const results = await Promise.all(
        dashboardConfig.map(async (cfg) => {
          const query = queryBuilder(cfg.baseSQL, filters);
          const raw = await athenaService(query, cfg.id);
          const parsed = cfg.parseResponse(raw, cfg);
          return { id: cfg.id, parsed };
        })
      );

      if (!cancelled) {
        const resultMap = {};
        results.forEach((r) => {
          resultMap[r.id] = r.parsed;
        });
        setDataMap(resultMap);
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

const App = () => (
  <FilterProvider>
    <Dashboard />
  </FilterProvider>
);

export default App;
