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
import { tabbedDashboardConfig } from './tabbedConfig'

const FilterContext = createContext();
const useFilters = () => useContext(FilterContext);

const KPIBox = ({ parsed, title }) => (
  <Box
    variant="container"
    padding="m"
    textAlign="center"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      border: '2px solid black',
      borderRadius: 8
    }}
  >
    <Box variant="awsui-key-label" margin={{ bottom: 'xxs' }}>{title}</Box>
    <Box fontWeight="bold" fontSize="display-l">{parsed?.value || '--'}</Box>
    <Box variant="small">{parsed?.label}</Box>
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
          <Box key={key} padding={{ bottom: 's' }}>
            <Box variant="awsui-key-label" margin={{ bottom: 'xxs' }}>{label}</Box>
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
          </Box>
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
      if (section.type === 'kpi' || section.type === 'graph') {
        for (const item of section.items || [section]) {
          setLoadingMap((prev) => ({ ...prev, [item.id]: true }));
          try {
            const query = queryBuilder(item.baseSQL, filters);
            const raw = await athenaService(query, item.id);
            const parsed = raw;
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
              <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
                {section.items.map((item) => (
                  <KPIBox
                    key={item.id}
                    title={item.title}
                    parsed={dataMap[item.id]}
                    loading={loadingMap[item.id]}
                  />
                ))}
              </Grid>
            )}
            {section.type === 'table' && (
              <Container>
                {loadingMap[section.id] ? <Box>Loading...</Box> : <DataTable parsed={dataMap[section.id]} />}
              </Container>
            )}
            {section.type === 'graph' && (
              <Container>
                {loadingMap[section.id] ? <Box>Loading...</Box> : (
                  <pre>{JSON.stringify(dataMap[section.id], null, 2)}</pre>
                )}
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
