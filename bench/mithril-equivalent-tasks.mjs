import { emitMithril } from '../lib/mithril-language.mjs';

export const shapePairs = {report:'claim-list',dashboard:'metric-cards',directory:'entity-directory'};
const base={name:'Incident review',description:'Reviewed public incident evidence.',headline:'Verified incidents',summary:'Three incidents are ready for review.',template:'report'};
const app=values=>({...base,...values});
const source=values=>emitMithril(app(values));

// Original public tasks. These are explicitly adapted static-document problems,
// not copied Terminal-Bench tasks or leaderboard-compatible replacements.
export const equivalentTasks=[
 {id:'create-report',kind:'create',ordinary:'Implement a static incident report from the supplied content contract.',goal:app({}),initial:'',expected:app({}),require_change:true},
 {id:'repair-summary',kind:'bugfix',ordinary:'Fix the incorrect incident count in a rendered report; preserve all other content.',goal:app({}),initial:source({summary:'Two incidents are ready for review.'}),expected:app({}),require_change:true},
 {id:'migrate-directory',kind:'migration',ordinary:'Migrate a report to a directory view while preserving its name and text.',goal:app({template:'directory'}),initial:source({}),expected:app({template:'directory'}),require_change:true},
 {id:'repair-shape',kind:'ontology',ordinary:'Resolve a schema/view mismatch so the report satisfies its template-to-shape contract and its visible content stays unchanged.',goal:app({}),initial:source({}).replace('/shape/claim-list','/shape/entity-directory'),expected:app({}),require_change:true,initial_shape_mismatch:true},
 {id:'repair-import',kind:'dependency',ordinary:'Repair a corrupted dependency lock using the supplied approved library binding; preserve visible output.',goal:app({}),initial:source({}).replace(/:digest "sha256:[^"]*"/,':digest "sha256:'+'0'.repeat(64)+'"'),expected:app({}),require_change:true,initial_refused:true},
 {id:'compact-refactor',kind:'refactor',ordinary:'Refactor source formatting to fewer UTF-8 bytes without changing any compiled semantics or visible output.',goal:app({}),initial:source({}).replaceAll('\n','\n            '),expected:app({}),require_change:true,preserve_ir:true,smaller_source:true},
];

export function taskById(id){const task=equivalentTasks.find(t=>t.id===id);if(!task)throw Error('unknown_task');return task;}

// Independent ordinary implementation: HTML generation is the problem's
// observable output, not a claim that arbitrary program behavior was translated.
export function ordinaryHtml(fields){
 const escape=value=>[...value].map(c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]??c)).join('');
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(fields.name)}</title><main><h1>${escape(fields.headline)}</h1><p>${escape(fields.summary)}</p><p>${escape(fields.description)}</p></main></html>\n`;
}

export function ontologyContract(task){
 return {scope:'Bounded app-agent-v1 catalog constraints; not arbitrary ontology reasoning.',
  asserted:{application:task.goal,template_shape_catalog:shapePairs},
  obligations:['exact-content','template-selects-shape','approved-ontology-and-library','semantic-stages-executed','ordinary-output-equivalence',...(task.preserve_ir?['preserve-entire-app-ir']:[]),...(task.smaller_source?['reduce-source-bytes']:[])],
  derived:{template:'https://mithril.fund/id/template/'+task.goal.template,data_shape:'https://mithril.fund/id/shape/'+shapePairs[task.goal.template]}};
}
