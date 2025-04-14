// filtersConfig.js
const filtersConfig = [
  {
    key: 'orgType',
    label: 'Org Type',
    type: 'multi-select',
    sql: '',
  },
  {
    key: 'team',
    label: 'Team',
    type: 'multi-select',
    sql: 'SELECT DISTINCT team FROM employee_data;',
  },
  {
    key: 'subTeam',
    label: 'SubTeam',
    type: 'multi-select',
    sql: 'SELECT DISTINCT sub_team FROM employee_data;',
  },
  {
    key: 'costCenter',
    label: 'Cost Center',
    type: 'multi-select',
    sql: 'SELECT DISTINCT cost_center FROM employee_data;',
  },
  {
    key: 'reportingDate',
    label: 'Reporting Date',
    type: 'date',
  },
  {
    key: 'reportToLogin',
    label: 'Report To Login',
    type: 'text',
    placeholder: 'Enter login ID',
  },
  {
    key: 'level',
    label: 'Level',
    type: 'multi-select',
    sql: 'SELECT DISTINCT level FROM employee_data;',
  },
  {
    key: 'virtualStatus',
    label: 'Virtual / Non-Virtual',
    type: 'multi-select',
    sql: 'SELECT DISTINCT virtual_status FROM employee_data;',
  },
  {
    key: 'hireType',
    label: 'Hire Type',
    type: 'multi-select',
    sql: 'SELECT DISTINCT hire_type FROM employee_data;',
  },
  {
    key: 'region',
    label: 'Region',
    type: 'multi-select',
    sql: 'SELECT DISTINCT region FROM employee_data;',
  },
];

export default filtersConfig;
