// App.jsx

import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  AppLayout,
  Box,
  Button,
  Container,
  Header,
  Multiselect,
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
import { tabbedDashboardConfig } from './tabbedConfig';

// ----------------- Parsing Logic -----------------
const parseKPI = (raw) => ({
  value: raw?.value ?? '--',
  label: raw?.label ?? '',
});

const parseGraph = (raw) => {
  const x = raw.map((r) => r.month || r.x || '');
  const y = raw.map((r) => r.count || r.y || 0);
  return { x, y };
};

const parseTable = (raw) => {
  if (!raw || !raw.length) return { headers: [], rows: [] };
  const headers = Object.keys(raw[0]);
  return { headers, rows: raw };
};

// ----------------- Filter Context -----------------
const FilterContext = createContext();
export const useFilters = () => useContext(FilterContext);

// ----------------- KPI Box -----------------
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

// ----------------- Data Table -----------------
const DataTable = ({ parsed }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (!parsed || !parsed.headers || !parsed.rows) return <Box>No Data</Box>;

  const totalPages = Math.ceil(parsed.rows.length / pageSize);
  const paginatedRows = parsed.rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '400px' }}>
      <Box margin={{ bottom: 's' }} display="flex" justifyContent="space-between" alignItems="center">
          <Select
          selectedOption={{ label: `${pageSize}`, value: `${pageSize}` }}
          onChange={({ detail }) => {
            setPageSize(Number(detail.selectedOption.value));
            setCurrentPage(1);
          }}
          options={[10, 20, 30, 50].map((v) => ({ label: `${v}`, value: `${v}` }))}
          placeholder="Rows per page"
        />
        <SpaceBetween direction="horizontal" size="xs">
          <Button iconName="angle-left" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} variant="icon" />
          <Box>Page {currentPage} of {totalPages}</Box>
          <Button iconName="angle-right" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} variant="icon" />
        </SpaceBetween>
      </Box>
      <table style={{ tableLayout: 'auto', width: '100%', borderCollapse: 'collapse' }} border="1" cellPadding={4}>
        <thead>
          <tr>{parsed.headers.map((h) => <th key={h} style={{ whiteSpace: 'nowrap', padding: '8px' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {paginatedRows.map((row, i) => (
            <tr key={i}>
              {parsed.headers.map((h) => (
                <td key={h} style={{ whiteSpace: 'nowrap', padding: '8px' }}>{row[h]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ----------------- Filter Controls -----------------
const FilterControls = ({ onApply }) => {
  const { tempFilters, setTempFilters } = useFilters();
  const [filterOptions, setFilterOptions] = useState({});
  const [isLoadingFilters, setIsLoadingFilters] = useState({});

  const handleChange = (key, value) => {
    setTempFilters((prev) => ({ ...prev, [key]: value }));
  };

  const loadOptionsForFilter = async (key, sql) => {
    if (filterOptions[key] || isLoadingFilters[key]) return;

    setIsLoadingFilters((prev) => ({ ...prev, [key]: true }));
    try {
      const raw = await athenaService(sql, key);
      const values = raw.map((r) => Object.values(r)[0]);
      const options = values.map((v) => ({ label: v, value: v }));
      setFilterOptions((prev) => ({ ...prev, [key]: options }));
    } catch (err) {
      console.error(`Error loading options for ${key}:`, err);
      setFilterOptions((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setIsLoadingFilters((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <SpaceBetween size="m">
      <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
        {filtersConfig.map(({ key, label, type, placeholder, sql }) => (
          <Box key={key} style={{ width: '100%' }}>
            <Box variant="awsui-key-label" margin={{ bottom: 'xxs' }}>{label}</Box>

            {type === 'multi-select' || type === 'select' ? (
              <Multiselect
                selectedOptions={(() => {
                  const options = filterOptions[key] || [];
                  const selected = tempFilters[key] || [];

                  if (selected.length === 0 && options.length > 0) {
                    return [{ label: 'Select All', value: '__select_all__' }];
                  }

                  const allSelected = selected.length === options.length;
                  return allSelected
                    ? [{ label: 'Unselect All', value: '__select_all__' }, ...selected]
                    : selected;
                })()}
                onFocus={() => sql && loadOptionsForFilter(key, sql)}
                onChange={({ detail }) => {
                  const allOptions = filterOptions[key] || [];
                  const selected = detail.selectedOptions;
                  const isSelectAllClicked = selected.find((opt) => opt.value === '__select_all__');
                  const current = tempFilters[key] || [];
                  const allSelected = current.length === allOptions.length;

                  if (isSelectAllClicked) {
                    handleChange(key, allSelected ? [] : allOptions);
                  } else {
                    const filtered = selected.filter((opt) => opt.value !== '__select_all__');
                    handleChange(key, filtered);
                  }
                }}
                loadingText="Loading..."
                statusType={isLoadingFilters[key] ? 'loading' : 'finished'}
                options={[
                  {
                    label:
                      (tempFilters[key] || []).length === (filterOptions[key] || []).length
                        ? 'Unselect All'
                        : 'Select All',
                    value: '__select_all__',
                  },
                  ...(filterOptions[key] || []),
                ]}
                placeholder={`Select ${label}`}
                filteringType="auto"
                tokenLimit={0} // ✅ Hide token preview under the dropdown
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


// ----------------- Dashboard -----------------
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
            const parsed = section.type === 'kpi' ? parseKPI(raw) : parseGraph(raw);
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
          const parsed = parseTable(raw);
          setDataMap((prev) => ({ ...prev, [id]: parsed }));
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

// ----------------- App Root -----------------
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
