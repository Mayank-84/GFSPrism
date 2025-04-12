// filtersConfig.js
const filtersConfig = [
  {
    key: 'orgType',
    label: 'Org Type',
    type: 'multi-select',
    options: ['Team1', 'Team2', 'Team3', 'All'],
  },
  {
    key: 'team',
    label: 'Team',
    type: 'multi-select',
    options: ['T1', 'T2', 'All'],
  },
  {
    key: 'subTeam',
    label: 'SubTeam',
    type: 'multi-select',
    options: ['ST1', 'ST2', 'ST3', 'All'],
  },
  {
    key: 'costCenter',
    label: 'Cost Center',
    type: 'multi-select',
    options: ['C1', 'C2', 'C3', 'All'],
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
    options: ['L1', 'L2', 'L4', 'All'],
  },
  {
    key: 'virtualStatus',
    label: 'Virtual / Non-Virtual',
    type: 'multi-select',
    options: ['Virtual', 'NonVirtual', 'All'],
  },
  {
    key: 'hireType',
    label: 'Hire Type',
    type: 'multi-select',
    options: ['Intern', 'Campus', 'All'],
  },
  {
    key: 'region',
    label: 'Region',
    type: 'multi-select',
    options: ['IND', 'US', 'All'],
  },
];

export default filtersConfig;
