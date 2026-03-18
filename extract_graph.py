import json
from collections import defaultdict

def extract_graph():
    with open('Drone_Map_IITK.ipynb', 'r', encoding='utf-8') as f:
        nb = json.load(f)
        
    code_cells = [c['source'] for c in nb['cells'] if c['cell_type'] == 'code']
    
    # We will look for exactly where nodes and edges are defined.
    # We will just print the textual contents of the notebook cells that contain "nodes" and "edges"
    for cell in code_cells:
        full_text = "".join(cell)
        if "osmnx" in full_text.lower() or "add_node" in full_text or "add_edge" in full_text or "node" in full_text:
            print("FOUND RELEVANT CELL:")
            print(full_text[:500])

extract_graph()
