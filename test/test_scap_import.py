import unittest, importlib.util
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('scap_import', root/'runtime/scap-import.py'); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ScapTests(unittest.TestCase):
 def setUp(self): self.xml=(root/'examples/scap/results.xml').read_text()
 def test_unknown_and_reference_preserved(self):
  r=m.import_xml(self.xml); self.assertEqual(len(r['records']),3);self.assertEqual(sum(x['failure'] for x in r['records']),2);self.assertEqual(len(r['gaps']),1);self.assertEqual(r['records'][0]['cves'],['CVE-2026-10001'])
 def test_declaration_namespace_and_duplicate_refused(self):
  for x in ['<!DOCTYPE x [<!ENTITY y SYSTEM "file:///etc/passwd">]>'+self.xml, self.xml.replace('http://oval.mitre.org/XMLSchema/oval-results-5','urn:spoof').replace('http://scap.nist.gov/schema/asset-reporting-format/1.1','urn:spoof'),self.xml.replace('<o:definition definition_id="oval:fixture:def:1" result="true"/>','<o:definition definition_id="oval:fixture:def:1" result="true"/>'*2)]:
   with self.assertRaises(ValueError):m.import_xml(x)
 def test_class_changes_boolean_interpretation(self):
  r=m.import_xml(self.xml.replace('class="vulnerability"','class="inventory"'));self.assertFalse(r['records'][0]['failure'])
 def test_definition_only_not_clean(self):
  x='<oval_definitions xmlns="http://oval.mitre.org/XMLSchema/oval-definitions-5"/>';self.assertTrue(m.import_xml(x)['gaps'])
 def test_multiple_systems_refused(self):
  with self.assertRaises(ValueError):m.import_xml(self.xml.replace('</o:system>','</o:system><o:system/>'))
 def test_fixed_requires_verification(self):
  r=m.import_xml(self.xml.replace('<x:result>fail</x:result>','<x:result>fixed</x:result>'));self.assertEqual(len(r['gaps']),2)

 def test_other_component_cannot_change_result_class(self):
  extra='<d:oval_definitions><d:definitions><d:definition id="oval:fixture:def:1" class="inventory"/></d:definitions></d:oval_definitions>'
  xml=self.xml.replace('<reports>',extra+'<reports>')
  self.assertTrue(m.import_xml(xml)['records'][0]['failure'])
 def test_same_result_scope_conflicting_definitions_refused(self):
  xml=self.xml.replace('<d:definitions>', '<d:definitions><d:definition id="oval:fixture:def:1" class="inventory"/>')
  with self.assertRaises(ValueError):m.import_xml(xml)
