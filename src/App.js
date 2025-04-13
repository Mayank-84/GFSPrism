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
  ExpandableSection,
  Tabs,
  Grid
} from '@cloudscape-design/components';

import filtersConfig from './filtersConfig';
import { athenaService, queryBuilder } from './athenaService';

const FilterContext = createContext();
const useFilters = () => useContext(FilterContext);

const tabbedDashboardConfig = [
  {
    id: 'headcount',
    label: 'HeadCount',
    sections: [
      {
        id: 'headcount_summary',
        title: 'Headcount Summary',
        type: 'kpi',
        items: [
          { id: 'hc_kpi_1', title: 'Total HC', baseSQL: 'SELECT label, value FROM total_hc LIMIT 1' },
          { id: 'hc_kpi_2', title: 'Open Positions', baseSQL: 'SELECT label, value FROM open_positions LIMIT 1' },
          { id: 'hc_kpi_3', title: 'Open Positions 3', baseSQL: 'SELECT label, value FROM open_positions LIMIT 1' }
        ]
      },
      {
        id: 'headcount_table',
        title: 'Headcount Detail',
        type: 'table',
        baseSQL: 'SELECT * FROM headcount_details'
      }
    ]
  },
  {
    id: 'hc',
    label: 'HC',
    sections: [
      {
        id: 'hc_stats',
        title: 'HC Stats',
        type: 'kpi',
        items: [
          { id: 'hc_stat_1', title: 'New Joinees', baseSQL: 'SELECT label, value FROM new_joinees LIMIT 1' },
          { id: 'hc_stat_2', title: 'Exits', baseSQL: 'SELECT label, value FROM exits LIMIT 1' }
        ]
      }
    ]
  },
  {
    id: 'imr',
    label: 'IMR',
    sections: [
      {
        id: 'imr_summary',
        title: 'IMR Overview',
        type: 'table',
        baseSQL: 'SELECT * FROM imr_summary'
      }
    ]
  },
  {
    id: 'cognos',
    label: 'Cognos',
    sections: [
      {
        id: 'cognos_metrics',
        title: 'Cognos Metrics',
        type: 'kpi',
        items: [
          { id: 'cognos_metric_1', title: 'Utilization', baseSQL: 'SELECT label, value FROM utilization LIMIT 1' }
        ]
      }
    ]
  }
];

const KPIBox = ({ parsed, title }) => (
  <Box variant="container" padding="m">
    <Header variant="h4">{title}</Header>
    <p style={{ fontSize: 22 }}>{parsed?.value || '--'}</p>
    <small>{parsed?.label}</small>
  </Box>
);

const DataTable = ({ parsed }) => {
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
    <SpaceBetween size="m">
      <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}> 
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
      </Grid>
      <Box>
        <Button variant="primary" onClick={onApply}>Apply Filters</Button>
      </Box>
    </SpaceBetween>
  );
};

const Dashboard = () => {
  const { filters, tempFilters, setFilters } = useFilters();
  const [dataMap, setDataMap] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [trigger, setTrigger] = useState(0);
  const [activeTabId, setActiveTabId] = useState('headcount');

  const applyFilters = () => {
    setFilters(tempFilters);
    setTrigger((t) => t + 1);
  };

  useEffect(() => {
    const activeTab = tabbedDashboardConfig.find((tab) => tab.id === activeTabId);
    if (!filters || !activeTab) return;

    activeTab.sections.forEach(async (section) => {
      if (section.type === 'kpi') {
        for (const item of section.items) {
          setLoadingMap((prev) => ({ ...prev, [item.id]: true }));
          try {
            const query = queryBuilder(item.baseSQL, filters);
            const raw = await athenaService(query, item.id);
            const parsed = raw[0] || {};
            setDataMap((prev) => ({ ...prev, [item.id]: parsed }));
          } catch (err) {
            console.error(err);
            setDataMap((prev) => ({ ...prev, [item.id]: null }));
          } finally {
            setLoadingMap((prev) => ({ ...prev, [item.id]: false }));
          }
        }
      } else if (section.type === 'table') {
        const id = section.id;
        setLoadingMap((prev) => ({ ...prev, [id]: true }));
        try {
          const query = queryBuilder(section.baseSQL, filters);
          const raw = await athenaService(query, id);
          const headers = Object.keys(raw[0] || {});
          setDataMap((prev) => ({ ...prev, [id]: { headers, rows: raw } }));
        } catch (err) {
          console.error(err);
          setDataMap((prev) => ({ ...prev, [id]: null }));
        } finally {
          setLoadingMap((prev) => ({ ...prev, [id]: false }));
        }
      }
    });
  }, [trigger, activeTabId]);

  const renderTabContent = () => {
    const activeTab = tabbedDashboardConfig.find((tab) => tab.id === activeTabId);
    if (!activeTab) return null;

    return (
      <SpaceBetween size="l">
        {activeTab.sections.map((section) => (
          <ExpandableSection key={section.id} headerText={section.title} defaultExpanded>
            {section.type === 'kpi' && (
              <SpaceBetween direction="horizontal" size="l">
                {section.items.map((item) => (
                  <KPIBox
                    key={item.id}
                    title={item.title}
                    parsed={dataMap[item.id]}
                    loading={loadingMap[item.id]}
                  />
                ))}
              </SpaceBetween>
            )}
            {section.type === 'table' && (
              <Container>
                {loadingMap[section.id] ? <Box>Loading...</Box> : <DataTable parsed={dataMap[section.id]} />}
              </Container>
            )}
          </ExpandableSection>
        ))}
      </SpaceBetween>
    );
  };

  return (
    <AppLayout
      content={
        <SpaceBetween size="l" direction="vertical" className="p-4">
          <ExpandableSection headerText="Controls" defaultExpanded>
            <FilterControls onApply={applyFilters} />
          </ExpandableSection>
          <Tabs
            tabs={tabbedDashboardConfig.map((tab) => ({
              id: tab.id,
              label: tab.label,
              content: renderTabContent()
            }))}
            activeTabId={activeTabId}
            onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          />
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
