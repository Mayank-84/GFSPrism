
// Filter.jsx
import React, { useState } from 'react';
import {
  Select,
  DatePicker,
  Input,
  FormField,
  Container,
  SpaceBetween,
  Button
} from '@amzn/awsui-components-react/polaris';
import './Filter.css';

const Filter = ({ query, setQuery }) => {
  // Define all options at the top of the component
  const orgTypeOptions = [
    { label: 'Corporate', value: 'corporate' },
    { label: 'Regional', value: 'regional' },
    { label: 'Branch', value: 'branch' },
    { label: 'Subsidiary', value: 'subsidiary' },
  ];

  const teamOptions = [
    { label: 'Engineering', value: 'engineering' },
    { label: 'Sales', value: 'sales' },
    { label: 'Marketing', value: 'marketing' },
    { label: 'Finance', value: 'finance' },
    { label: 'HR', value: 'hr' },
  ];

  const subteamOptions = [
    { label: 'Frontend', value: 'frontend' },
    { label: 'Backend', value: 'backend' },
    { label: 'DevOps', value: 'devops' },
    { label: 'QA', value: 'qa' },
    { label: 'UX/UI', value: 'uxui' },
  ];

  const costCenterOptions = [
    { label: 'CC001', value: 'cc001' },
    { label: 'CC002', value: 'cc002' },
    { label: 'CC003', value: 'cc003' },
    { label: 'CC004', value: 'cc004' },
  ];

  const levelOptions = [
    { label: 'L1', value: 'l1' },
    { label: 'L2', value: 'l2' },
    { label: 'L3', value: 'l3' },
    { label: 'L4', value: 'l4' },
    { label: 'L5', value: 'l5' },
    { label: 'L6', value: 'l6' },
  ];

  // State for each field
  const [orgType, setOrgType] = useState(null);
  const [team, setTeam] = useState(null);
  const [subteam, setSubteam] = useState(null);
  const [costCenter, setCostCenter] = useState(null);
  const [reportingDate, setReportingDate] = useState('');
  const [reportsTo, setReportsTo] = useState('');
  const [level, setLevel] = useState(null);

  const handleDateChange = ({ detail }) => {
    if (detail.value) {
      setReportingDate(detail.value);
    }
  };

  // Apply filters function
  const applyFilters = () => {
    const newTokens = [];
    
    if (orgType) {
      newTokens.push({
        propertyKey: 'orgType',
        operator: '=',
        value: orgType.value
      });
    }

    if (team) {
      newTokens.push({
        propertyKey: 'team',
        operator: '=',
        value: team.value
      });
    }

    if (subteam) {
      newTokens.push({
        propertyKey: 'subteam',
        operator: '=',
        value: subteam.value
      });
    }

    if (costCenter) {
      newTokens.push({
        propertyKey: 'costCenter',
        operator: '=',
        value: costCenter.value
      });
    }

    if (reportingDate) {
      newTokens.push({
        propertyKey: 'reportingDate',
        operator: '=',
        value: reportingDate
      });
    }

    if (reportsTo) {
      newTokens.push({
        propertyKey: 'reportsTo',
        operator: '=',
        value: reportsTo
      });
    }

    if (level) {
      newTokens.push({
        propertyKey: 'level',
        operator: '=',
        value: level.value
      });
    }

    setQuery({
      tokens: newTokens,
      operation: 'and'
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setOrgType(null);
    setTeam(null);
    setSubteam(null);
    setCostCenter(null);
    setReportingDate('');
    setReportsTo('');
    setLevel(null);
    setQuery({ tokens: [], operation: 'and' });
  };

  return (
    <div className="filter-grid">
      <FormField label="Organization Type">
        <Select
          selectedOption={orgType}
          onChange={({ detail }) => setOrgType(detail.selectedOption)}
          options={orgTypeOptions}
          placeholder="Choose organization type"
        />
      </FormField>

      <FormField label="Team">
        <Select
          selectedOption={team}
          onChange={({ detail }) => setTeam(detail.selectedOption)}
          options={teamOptions}
          placeholder="Choose team"
        />
      </FormField>

      <FormField label="Subteam">
        <Select
          selectedOption={subteam}
          onChange={({ detail }) => setSubteam(detail.selectedOption)}
          options={subteamOptions}
          placeholder="Choose subteam"
        />
      </FormField>

      <FormField label="Cost Center">
        <Select
          selectedOption={costCenter}
          onChange={({ detail }) => setCostCenter(detail.selectedOption)}
          options={costCenterOptions}
          placeholder="Choose cost center"
        />
      </FormField>

      <FormField label="Reporting Date">
        <DatePicker
          value={reportingDate}
          onChange={handleDateChange}
          placeholder="YYYY/MM/DD"
          openCalendarAriaLabel={selectedDate =>
            'Choose date' + (selectedDate ? `, selected date is ${selectedDate}` : '')
          }
          todayAriaLabel="Today"
        />
      </FormField>

      <FormField label="Reports To Login">
        <Input
          value={reportsTo}
          onChange={({ detail }) => setReportsTo(detail.value)}
          placeholder="Enter value"
        />
      </FormField>

      <FormField label="Level">
        <Select
          selectedOption={level}
          onChange={({ detail }) => setLevel(detail.selectedOption)}
          options={levelOptions}
          placeholder="Choose level"
        />
      </FormField>

      <div className="filter-buttons">
        <Button onClick={clearFilters}>
          Clear Filters
        </Button>
        <Button onClick={applyFilters} variant="primary">
          Apply Filters
        </Button>
      </div>
    </div>
  );
};

export default Filter;


