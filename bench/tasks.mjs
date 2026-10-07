// Public contract fixtures, not held-out general software-engineering tasks.
export const tasks = Array.from({length:20},(_,i)=>({
 id:`static-${String(i+1).padStart(2,'0')}`,
 expected:{name:`Mithril benchmark ${i+1}`,description:`Self-contained static document ${i+1}.`,headline:`Verified document ${i+1}`,summary:`Review exact content for scenario ${i+1}.`,template:['report','dashboard','directory'][i%3]}
}));
export const brief = task => 'Create a static Mithril application with exactly these fields, without translating or embellishing the text: '+JSON.stringify(task.expected);
