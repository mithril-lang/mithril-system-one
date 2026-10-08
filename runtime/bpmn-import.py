"""Bounded inert BPMN structural profile; never executes BPMN expressions or tasks."""
import hashlib
import json
import sys
import xml.etree.ElementTree as ET

B = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
M = 'https://mithril.fund/business-process/v1'
TYPES = {'startEvent', 'endEvent', 'task', 'userTask', 'serviceTask', 'exclusiveGateway'}

def parse(xml):
    if not isinstance(xml, str) or len(xml.encode()) > 1048576:
        raise ValueError('budget')
    if '<!DOCTYPE' in xml.upper() or '<!ENTITY' in xml.upper():
        raise ValueError('declaration')
    root = ET.fromstring(xml)
    if root.tag != '{'+B+'}definitions':
        raise ValueError('namespace')
    elements = list(root.iter())
    if len(elements) > 10000:
        raise ValueError('nodes')
    def depth(e, d=0):
        if d > 64: raise ValueError('depth')
        for c in e: depth(c, d+1)
    depth(root)
    ids = [e.attrib['id'] for e in elements if 'id' in e.attrib]
    if len(ids) != len(set(ids)) or any(not i or len(i)>200 for i in ids):
        raise ValueError('identity')
    processes = root.findall('{'+B+'}process')
    if len(processes) != 1 or any(e.tag.startswith('{'+B+'}') and e.tag not in {'{'+B+'}process'} for e in root):
        raise ValueError('single_process_only')
    p = processes[0]
    if not p.attrib.get('id'): raise ValueError('process_identity')
    if set(p.attrib)-{'id','name','isExecutable'} or p.attrib.get('isExecutable','false') != 'false': raise ValueError('executable_process_unsupported')
    nodes, flows = [], []
    for e in p:
        kind = e.tag.removeprefix('{'+B+'}')
        if kind == 'sequenceFlow':
            if list(e) or set(e.attrib)-{'id','name','sourceRef','targetRef'}: raise ValueError('flow_expressions_unsupported')
            flows.append({'id':e.attrib.get('id'), 'source':e.attrib.get('sourceRef'), 'target':e.attrib.get('targetRef')})
        elif kind in TYPES:
            if any(c.tag not in {'{'+B+'}incoming','{'+B+'}outgoing'} for c in e):
                raise ValueError('node_semantics_unsupported')
            allowed = {'id','name'} | {'{'+M+'}'+k for k in ['operation','control','principal','authorized','audited']}
            if set(e.attrib)-allowed: raise ValueError('node_attributes_unsupported')
            n = {'id':e.attrib.get('id'), 'kind':kind, 'name':e.attrib.get('name','')}
            for k in ['operation','control','principal','authorized','audited']:
                v=e.attrib.get('{'+M+'}'+k)
                if v is not None:
                    if not v or len(v)>200: raise ValueError('annotation')
                    if k in ['authorized','audited']:
                        if v not in ['true','false']: raise ValueError('boolean')
                        v=v=='true'
                    n[k]=v
            if n.get('operation') not in [None,'request','approve','execute']: raise ValueError('operation')
            if n.get('operation') and not n.get('control'): raise ValueError('control')
            if n.get('operation') and kind not in {'task','userTask','serviceTask'}: raise ValueError('event_operation')
            nodes.append(n)
        elif kind == 'documentation':
            pass
        else:
            raise ValueError('unsupported_bpmn_semantics')
    if not nodes or len(nodes)>100 or len(flows)>200: raise ValueError('graph_budget')
    by={n['id']:n for n in nodes}
    if None in by or any(not f['id'] or f['source'] not in by or f['target'] not in by for f in flows): raise ValueError('references')
    starts=[n for n in nodes if n['kind']=='startEvent']
    ends=[n for n in nodes if n['kind']=='endEvent']
    if len(starts)!=1 or not ends: raise ValueError('events')
    adj={i:[] for i in by}; rev={i:[] for i in by}
    for f in flows: adj[f['source']].append(f['target']); rev[f['target']].append(f['source'])
    for n in nodes:
        i=n['id']; out=len(adj[i]); inc=len(rev[i])
        element=next(e for e in p if e.attrib.get('id')==i)
        for direction, key in [('incoming','target'),('outgoing','source')]:
            refs=element.findall('{'+B+'}'+direction)
            if refs and (any(list(e) or e.attrib for e in refs) or sorted(e.text or '' for e in refs)!=sorted(f['id'] for f in flows if f[key]==i)): raise ValueError('flow_node_reference_mismatch')
        if n['kind']=='startEvent' and inc: raise ValueError('start_incoming')
        if n['kind']=='endEvent' and out: raise ValueError('end_outgoing')
        if n['kind'] not in ['endEvent','exclusiveGateway'] and out!=1: raise ValueError('implicit_split')
        if n['kind']=='exclusiveGateway' and (out<1 or (out==1 and inc<2)): raise ValueError('gateway')
        if n['kind'] not in ['endEvent','exclusiveGateway','startEvent'] and inc!=1: raise ValueError('implicit_join')
    def walk(seeds, edges):
        seen=set(seeds); todo=list(seeds)
        while todo:
            for j in edges[todo.pop()]:
                if j not in seen: seen.add(j); todo.append(j)
        return seen
    if walk([starts[0]['id']],adj)!=set(by) or walk([n['id'] for n in ends],rev)!=set(by): raise ValueError('disconnected')
    degrees={i:len(rev[i]) for i in by}; todo=[i for i in by if not degrees[i]]; order=[]
    while todo:
        i=todo.pop(); order.append(i)
        for j in adj[i]:
            degrees[j]-=1
            if not degrees[j]: todo.append(j)
    if len(order)!=len(by): raise ValueError('cycles_unsupported')
    if not any(n.get('operation')=='execute' for n in nodes): raise ValueError('no_declared_sensitive_action')
    return {'sha256':hashlib.sha256(xml.encode()).hexdigest(), 'process':p.attrib.get('id'), 'nodes':nodes, 'flows':flows, 'order':order}

if __name__=='__main__':
    try:
        raw=sys.stdin.buffer.read(2097153)
        if len(raw)>2097152: raise ValueError('budget')
        value=json.loads(raw)
        if not isinstance(value,dict) or set(value)!={'xml'}: raise ValueError('arguments')
        print(json.dumps(parse(value['xml'])))
    except (ValueError, TypeError, ET.ParseError, RecursionError):
        print(json.dumps({'error':'bpmn_import_refused'})); sys.exit(1)
