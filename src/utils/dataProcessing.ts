// src/utils/dataProcessing.ts
// src/utils/dataProcessing.ts
import type { ActivityRow } from '../types';

export const parseSheetData = (values: any[][]): ActivityRow[] => {
  if (!values || values.length < 2) {
    return [];
  }
  const header = values[0];
  const data = values.slice(1);
  return data.map((row, index) => {
    const rowData: ActivityRow = {};
    header.forEach((key, headerIndex) => {
      rowData[key] = row[headerIndex];
    });
    rowData.originalIndex = (index + 2).toString();
    return rowData;
  });
};

export const processDataForChart = (data: ActivityRow[]) => {
  const dailyData: { [date: string]: { date: string; pooped: number; formula: number; sleep: number } } = {};
  data.forEach(row => {
    if (!row || !row.Date) return;
    const dateKey = row.Date.split(' ')[0];
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = { date: dateKey, pooped: 0, formula: 0, sleep: 0 };
    }
    switch (row.Activity) {
      case 'Pooped':
        dailyData[dateKey].pooped += 1;
        break;
      case 'Formula':
        dailyData[dateKey].formula += Number(row.Quantity) || 0;
        break;
      case 'SleepEnded':
        dailyData[dateKey].sleep += (Number(row.Quantity) || 0) / 60;
        break;
      default:
        break;
    }
  });
  return Object.values(dailyData).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const calculateSummary = (data: ActivityRow[]) => {
  let totalFormula = 0, totalSleep = 0, totalPooped = 0;
  if (data.length === 0) return { avgFormula: 0, avgSleep: 0, totalPooped: 0 };
  const uniqueDaysInRange = new Set(data.map(row => row.Date.split(' ')[0])).size;
  data.forEach(row => {
    if (row.Activity === 'Formula') totalFormula += Number(row.Quantity) || 0;
    if (row.Activity === 'Pooped') totalPooped += 1;
    if (row.Activity === 'SleepEnded') totalSleep += (Number(row.Quantity) || 0) / 60;
  });
  const avgSleep = uniqueDaysInRange > 0 ? totalSleep / uniqueDaysInRange : 0;
  const avgFormula = uniqueDaysInRange > 0 ? totalFormula / uniqueDaysInRange : 0;
  return { avgFormula, avgSleep, totalPooped };
};
