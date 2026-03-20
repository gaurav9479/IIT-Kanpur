import json

with open(r'c:\Users\OMI\OneDrive\Desktop\IIT-Kanpur\Drone_Map_IITK  final.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

keywords = ['red_zone','redzone','red zone','power','charging','battery','path','route','patrol','waypoint','hub','station','iitk_drone','airspace']

for i, cell in enumerate(nb['cells']):
    src = ''.join(cell['source'])
    if any(kw.lower() in src.lower() for kw in keywords):
        print('--- Cell %d (type=%s) ---' % (i, cell['cell_type']))
        print(src[:1200])
        print()
