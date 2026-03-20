import json, sys

with open(r'c:\Users\OMI\OneDrive\Desktop\IIT-Kanpur\Drone_Map_IITK  final.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

print('Total cells:', len(nb['cells']))

# Print all cell source (first 600 chars) plus cell outputs if any contain lat/lng data
keywords = ['red_zone','redzone','red zone','power','charging','battery','path','route',
            'patrol','waypoint','hub','station','airspace','lat','lng','coordinate',
            'folium','marker','polygon','polyline','26.5','80.2']

out = open('nb_cells_out.txt', 'w', encoding='utf-8')
for i, cell in enumerate(nb['cells']):
    src = ''.join(cell['source'])
    if any(kw.lower() in src.lower() for kw in keywords):
        out.write('--- Cell %d (type=%s) ---\n' % (i, cell['cell_type']))
        out.write(src[:2000] + '\n')
        # also write outputs
        if 'outputs' in cell:
            for o in cell['outputs']:
                if 'text' in o:
                    out.write('[OUTPUT]: ' + ''.join(o['text'])[:500] + '\n')
        out.write('\n')
out.close()
print('Done. See nb_cells_out.txt')
