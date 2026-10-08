"""Bounded inert SCAP result import. No XML entities, probes, fixes or remote refs."""
import json, sys, re, hashlib
import xml.etree.ElementTree as ET
OVAL = 'http://oval.mitre.org/XMLSchema/oval-results-5'
XCCDF = 'http://checklists.nist.gov/xccdf/1.2'
DS = 'http://scap.nist.gov/schema/scap/source/1.2'
ARF = 'http://scap.nist.gov/schema/asset-reporting-format/1.1'
DEF = 'http://oval.mitre.org/XMLSchema/oval-definitions-5'

def import_xml(text):
    if not isinstance(text, str) or len(text.encode()) > 1048576 or '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper():
        raise ValueError('xml_budget_or_declaration')
    root = ET.fromstring(text)
    allowed = {f'{{{OVAL}}}oval_results', f'{{{XCCDF}}}Benchmark', f'{{{XCCDF}}}TestResult', f'{{{DS}}}data-stream-collection', f'{{{ARF}}}asset-report-collection', f'{{{DEF}}}oval_definitions'}
    if root.tag not in allowed: raise ValueError('unsupported_xml_root')
    nodes = list(root.iter())
    if len(nodes) > 10000: raise ValueError('xml_node_budget')
    def depth(e, d=0):
        if d > 64: raise ValueError('xml_depth_budget')
        for c in e: depth(c, d+1)
    depth(root)
    records, gaps, definitions = [], [], []
    for e in root.iter(f'{{{DEF}}}definition'):
        ident = e.get('id')
        if not ident or len(ident) > 256: raise ValueError('definition_identity')
        refs = [r.get('ref_id') for r in e.iter(f'{{{DEF}}}reference') if r.get('source') == 'CVE']
        definitions.append({'id': ident, 'class': e.get('class'), 'cves': [r for r in refs if r and re.fullmatch(r'CVE-\d{4}-\d{4,}', r)]})
    # Preserve result meaning: OVAL true is not universally a vulnerability.
    for container in root.iter(f'{{{OVAL}}}oval_results'):
        systems = container.findall(f'{{{OVAL}}}results/{{{OVAL}}}system')
        if len(systems) != 1: raise ValueError('oval_system_scope_ambiguous')
        for e in systems[0].findall(f'{{{OVAL}}}definitions/{{{OVAL}}}definition'):
            ident, value = e.get('definition_id'), e.get('result')
            if not ident or value not in {'true','false','unknown','error','not evaluated','not applicable'}: raise ValueError('oval_result_invalid')
            meta = [d for d in definitions if d['id'] == ident]
            if len(meta) > 1: raise ValueError('oval_definition_ambiguous')
            cls = meta[0]['class'] if meta else None
            failure = (value == 'true' and cls in {'vulnerability','patch'}) or (value == 'false' and cls == 'compliance')
            records.append({'id':ident,'kind':'oval','result':value,'definition_class':cls,'failure':failure,'cves':meta[0]['cves'] if meta else []})
            if cls not in {'vulnerability','patch','compliance','inventory'} or value in {'unknown','error','not evaluated'}:
                gaps.append({'id':ident,'reason':'oval_semantics_or_result_unknown'})
    tests = list(root.iter(f'{{{XCCDF}}}TestResult'))
    if len(tests) > 1: raise ValueError('xccdf_result_scope_ambiguous')
    for t in tests:
        targets = [e.text for e in t.findall(f'{{{XCCDF}}}target')]
        if not targets or any(not x or len(x)>256 for x in targets): raise ValueError('xccdf_target_absent')
        for e in t.findall(f'{{{XCCDF}}}rule-result'):
            ident = e.get('idref'); values=e.findall(f'{{{XCCDF}}}result')
            value=values[0].text if len(values)==1 else None
            if not ident or value not in {'pass','fail','error','unknown','notapplicable','notchecked','notselected','informational','fixed'}: raise ValueError('xccdf_result_invalid')
            refs=[{'href':r.get('href'),'name':r.get('name')} for r in e.iter(f'{{{XCCDF}}}check-content-ref')]
            records.append({'id':ident,'kind':'xccdf','result':value,'failure':value=='fail','targets':targets,'check_refs':refs})
            if value in {'error','unknown','notchecked','fixed'}: gaps.append({'id':ident,'reason':'xccdf_unverified_or_unevaluated'})
    if len(records)>2000: raise ValueError('result_budget')
    keys=[(r['kind'],r['id']) for r in records]
    if len(set(keys))!=len(keys): raise ValueError('duplicate_result_identity')
    if not records: gaps.append({'reason':'no_scan_results_host_not_evaluated'})
    return {'records':records,'definitions':definitions,'gaps':gaps,'sha256':hashlib.sha256(text.encode()).hexdigest(),'scope':'caller-supplied scan results; no host probes, definition interpreter, remote references or fixes'}

if __name__ == '__main__':
    try:
        raw=sys.stdin.buffer.read(1048705)
        if len(raw)>1048704: raise ValueError('input_budget')
        args=json.loads(raw)
        if set(args) != {'xml'}: raise ValueError('input_keys')
        print(json.dumps(import_xml(args['xml'])))
    except Exception:
        print(json.dumps({'error':'scap_import_refused'})); sys.exit(1)
