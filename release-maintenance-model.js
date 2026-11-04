import {formatReleaseDate} from './release-calendar-model.js';
export function releaseScheduleLabel(value){
  if(value.status==='cancelled')return '発売中止';
  if(value.status==='delayed')return '延期・新日程は未定';
  const d=value.release_date;
  if(value.date_precision==='day'&&/^\d{4}-\d{2}-\d{2}$/.test(d??''))return `${d.slice(0,4)}年${formatReleaseDate(d)}`;
  if(value.date_precision==='month'&&d)return `${d.slice(0,4)}年${Number(d.slice(5,7))}月予定`;
  if(value.date_precision==='year'&&d)return `${d.slice(0,4)}年予定`;
  return value.release_label||'発売日未定';
}
