"""Bounded offline concrete-syntax extraction. Never import submitted source."""
import json
import sys
from importlib.metadata import version

PINS = {"tree-sitter-language-pack": "0.13.0", "tree-sitter": "0.26.0",
        "tree-sitter-c-sharp": "0.23.5", "tree-sitter-embedded-template": "0.25.0",
        "tree-sitter-yaml": "0.7.2"}
LANGUAGES = {"c", "cpp", "java", "csharp", "php", "ruby", "python", "go",
             "rust", "kotlin", "swift", "scala"}
DEFINITIONS = {"function_definition", "function_declaration", "method_declaration",
               "method_definition", "method", "singleton_method", "function_item",
               "class_definition", "class_declaration", "class_specifier",
               "struct_specifier", "struct_item", "interface_declaration",
               "enum_declaration", "object_definition", "trait_definition"}
CALLS = {"call", "call_expression", "invocation_expression", "method_invocation", "function_call_expression",
         "member_call_expression", "scoped_call_expression", "object_creation_expression"}
IMPORTS = {"import_statement", "import_declaration", "import_from_statement",
           "preproc_include", "using_directive", "use_declaration", "namespace_use_declaration"}


def extract(request):
    if set(request) != {"language", "source"} or request["language"] not in LANGUAGES:
        raise ValueError("parser_input_refused")
    source = request["source"].encode("utf-8")
    if len(source) > 262144:
        raise ValueError("parser_source_budget")
    if any(version(k) != v for k, v in PINS.items()):
        raise ValueError("parser_pin_refused")
    from tree_sitter_language_pack import get_parser
    tree = get_parser(request["language"]).parse(source)
    if tree.root_node.has_error:
        return {"parsed": False, "reason": "unsupported_syntax", "facts": [], "pins": PINS}
    facts = []
    stack = [(tree.root_node, None)]
    count = 0

    def text(node):
        return source[node.start_byte:node.end_byte].decode("utf-8") if node else None

    while stack:
        node, owner = stack.pop()
        count += 1
        if count > 50000:
            raise ValueError("parser_node_budget")
        kind = "definition" if node.type in DEFINITIONS else "call" if node.type in CALLS else "import" if node.type in IMPORTS else None
        if kind:
            name = node.child_by_field_name("name")
            if kind == "call":
                name = node.child_by_field_name("function") or node.child_by_field_name("name") or node.child_by_field_name("method") or node.child_by_field_name("constructor")
            if kind == "definition" and name is None:
                declarator = node.child_by_field_name("declarator")
                while declarator:
                    name = declarator if declarator.type in {"identifier", "field_identifier"} else None
                    if name:
                        break
                    declarator = declarator.child_by_field_name("declarator")
            if name is None and request["language"] in {"kotlin", "swift"}:
                name = next((c for c in node.named_children if c.type == "simple_identifier"), None)
            spelling = text(name) if name else text(node) if kind == "import" else None
            # Unknown names are explicit; do not guess a symbol from source text.
            if spelling and len(spelling.encode("utf-8")) > 512:
                spelling = None
            fact = {"kind": kind, "syntax": node.type, "spelling": spelling,
                    "owner": owner, "start_byte": node.start_byte, "end_byte": node.end_byte,
                    "line": node.start_point.row + 1, "column": node.start_point.column + 1,
                    "end_line": node.end_point.row + 1, "end_column": node.end_point.column + 1,
                    "resolution": "syntactic_only"}
            facts.append(fact)
            if len(facts) > 2000:
                raise ValueError("parser_fact_budget")
            if kind == "definition":
                owner = node.start_byte
        stack.extend((child, owner) for child in reversed(node.named_children))
    return {"parsed": True, "facts": facts, "pins": PINS}


if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read(1600001)
        if len(raw) > 1600000:
            raise ValueError("parser_frame_budget")
        result = extract(json.loads(raw))
        print(json.dumps(result, ensure_ascii=True))
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and str(error).startswith("parser_") else "parser_runtime_unavailable"
        print(json.dumps({"parsed": False, "reason": code, "facts": []}))
        sys.exit(1)
