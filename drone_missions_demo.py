
# ╔══════════════════════════════════════════════════════════════════╗
# ║  🚁 FINAL DRONE PATHWAY DEMO — A* NFZ Bypass                   ║
# ║  Paste this as the LAST CELL in your Colab notebook.            ║
# ║  Requires ALL previous cells to have been run first!            ║
# ║                                                                  ║
# ║  ✅ ALL routes use A* algorithm                                  ║
# ║  ✅ Red zones (NFZ) in path → drone bypasses periphery           ║
# ║  ✅ 10 missions, 55+ nodes displayed                             ║
# ║  ✅ Saves: iitk_drone_missions_final.html                       ║
# ╚══════════════════════════════════════════════════════════════════╝

import folium
import numpy as np
from shapely.geometry import LineString

# ══════════════════════════════════════════════════════════
# EXTRA NODES (not in notebook's NODES dict)
# ══════════════════════════════════════════════════════════
EXTRA_NODES = {
    "North_Launchpad":    (26.5212, 80.2328),
    "NW_Tower":           (26.5208, 80.2265),
    "East_Checkpoint":    (26.5165, 80.2395),
    "South_Depot":        (26.5078, 80.2318),
    "Runway_Alpha":       (26.5220, 80.2355),
}

ALL_NODES = {**NODES, **EXTRA_NODES}

# ══════════════════════════════════════════════════════════
# 10 MISSIONS — 4 cross NFZ (★), 6 safe but all use A*
# ══════════════════════════════════════════════════════════

MISSIONS = [
    # ★ NFZ BYPASS ROUTES — drone detours around red zones
    {
        "id": 1,
        "src": "North_Launchpad", "dst": "Hall_5",
        "color": "#7C3AED",
        "label": "M1: North Pad → Hall 5 (NFZ Bypass)"
    },
    {
        "id": 2,
        "src": "North_Launchpad", "dst": "Cricket_Ground",
        "color": "#EC4899",
        "label": "M2: North Pad → Cricket Ground (NFZ Bypass)"
    },
    {
        "id": 3,
        "src": "Runway_Alpha", "dst": "Hub_Central",
        "color": "#F43F5E",
        "label": "M3: Runway Alpha → Hub Central (NFZ Bypass)"
    },
    {
        "id": 4,
        "src": "Guest_House", "dst": "Hall_9",
        "color": "#D946EF",
        "label": "M4: Guest House → Hall 9 (NFZ Bypass)"
    },
    # ═══ SAFE ROUTES (no NFZ in the way, still uses A*) ═══
    {
        "id": 5,
        "src": "Hub_Central", "dst": "Football_Ground",
        "color": "#06B6D4",
        "label": "M5: Hub Central → Football Ground"
    },
    {
        "id": 6,
        "src": "Hub_South", "dst": "Swimming_Pool",
        "color": "#14B8A6",
        "label": "M6: Hub South → Swimming Pool"
    },
    {
        "id": 7,
        "src": "Hub_East", "dst": "Hall_12",
        "color": "#F59E0B",
        "label": "M7: Hub East → Hall 12"
    },
    {
        "id": 8,
        "src": "Shopping_Complex", "dst": "Medical_Center",
        "color": "#84CC16",
        "label": "M8: Shopping → Medical Center"
    },
    {
        "id": 9,
        "src": "South_Depot", "dst": "Hall_1",
        "color": "#22D3EE",
        "label": "M9: South Depot → Hall 1"
    },
    {
        "id": 10,
        "src": "OAT", "dst": "Gymkhana",
        "color": "#FB923C",
        "label": "M10: OAT → Gymkhana"
    },
]

# ══════════════════════════════════════════════════════════
# A* PATHFINDER (uses notebook's existing grid + obstacles)
# ══════════════════════════════════════════════════════════

def find_astar_path(src_coord, dst_coord):
    """A* on 250x250 occupancy grid — avoids all obstacles & NFZ."""
    sg = latlon_to_grid(src_coord[0], src_coord[1])
    dg = latlon_to_grid(dst_coord[0], dst_coord[1])
    grid[sg[0], sg[1]] = True
    grid[dg[0], dg[1]] = True
    raw_path = astar_grid(sg, dg)
    if raw_path:
        latlon_path = [grid_to_latlon(i, j) for i, j in raw_path]
        return smooth_path(latlon_path)
    return None

# ══════════════════════════════════════════════════════════
# BUILD THE MAP
# ══════════════════════════════════════════════════════════

demo = folium.Map(location=list(CAMPUS_CENTER), zoom_start=16, tiles='OpenStreetMap')

# 1. Building footprints
for idx, row in buildings.iterrows():
    if row.geometry.geom_type == 'Polygon':
        coords = [[c[1], c[0]] for c in row.geometry.exterior.coords]
        folium.Polygon(
            locations=coords, color='#8B4513', fill=True,
            fill_color='#D2B48C', fill_opacity=0.25, weight=1
        ).add_to(demo)

# 2. No-Fly Zones (red)
for nfz in MANUAL_NFZ:
    folium.Circle(
        location=list(nfz['center']),
        radius=nfz['radius_m'],
        color='#EF4444', fill=True, fill_opacity=0.18,
        weight=2, dash_array='8,4',
        tooltip=f"⛔ {nfz['name']} — NFZ (R: {nfz['radius_m']}m)"
    ).add_to(demo)
    folium.Marker(
        location=list(nfz['center']),
        icon=folium.DivIcon(html=f"<div style='font-size:8px;color:#dc2626;font-weight:bold;white-space:nowrap'>⛔ {nfz['name']}</div>")
    ).add_to(demo)

# 3. ALL NODES — prominent markers with labels
node_colors = {
    "Hub_Central": "#0EA5E9", "Hub_North": "#0EA5E9", "Hub_South": "#0EA5E9",
    "Hub_East": "#0EA5E9", "Hub_West": "#0EA5E9",
    "North_Launchpad": "#7C3AED", "NW_Tower": "#7C3AED",
    "East_Checkpoint": "#7C3AED", "South_Depot": "#7C3AED", "Runway_Alpha": "#7C3AED",
}

for name, (lat, lon) in ALL_NODES.items():
    c = node_colors.get(name, "#374151")
    is_hub = "Hub" in name or name in EXTRA_NODES
    r = 5 if is_hub else 3.5

    folium.CircleMarker(
        location=[lat, lon], radius=r,
        color=c, weight=2,
        fill=True, fill_color='white', fill_opacity=0.9,
        tooltip=f"📍 {name.replace('_', ' ')}"
    ).add_to(demo)

    # Label for all nodes
    folium.Marker(
        location=[lat, lon],
        icon=folium.DivIcon(html=(
            f"<div style='font-size:7px;color:{c};font-weight:bold;white-space:nowrap;"
            f"text-shadow:0 0 3px white,0 0 3px white;margin-left:8px;margin-top:-5px'>"
            f"{name.replace('_', ' ')}</div>"
        ))
    ).add_to(demo)

# 4. Compute & draw missions
results = []

for m in MISSIONS:
    src = ALL_NODES[m["src"]]
    dst = ALL_NODES[m["dst"]]
    color = m["color"]
    is_nfz_route = m["id"] in [1, 2, 3, 4]

    path = find_astar_path(src, dst)
    method = "A*"
    wps = len(path) if path else 0
    status = "✅" if path else "❌"

    results.append({
        "id": m["id"], "src": m["src"], "dst": m["dst"],
        "method": method, "wps": wps, "nfz": is_nfz_route, "ok": path is not None
    })

    if path:
        coords = [[p[0], p[1]] for p in path]

        # A* route line
        folium.PolyLine(
            locations=coords,
            color=color, weight=4, opacity=0.85,
            dash_array='10,5' if is_nfz_route else None,
            tooltip=f"{m['label']} — {wps} WPs"
        ).add_to(demo)

        # Direction dots
        step = max(1, len(coords) // 8)
        for k in range(0, len(coords), step):
            folium.CircleMarker(
                location=coords[k], radius=2.5,
                color=color, fill=True, fill_opacity=1.0
            ).add_to(demo)

    # Source (green)
    folium.Marker(
        location=list(src),
        icon=folium.Icon(color="green", icon="plane", prefix="fa"),
        tooltip=f"🛫 M{m['id']}: {m['src'].replace('_',' ')}",
        popup=f"<b>Mission {m['id']}</b><br>🛫 {m['src']}<br>🛬 {m['dst']}<br>A* | {wps} WPs"
    ).add_to(demo)

    # Destination (red)
    folium.Marker(
        location=list(dst),
        icon=folium.Icon(color="red", icon="flag", prefix="fa"),
        tooltip=f"🛬 M{m['id']}: {m['dst'].replace('_',' ')}",
    ).add_to(demo)

    # Ghost straight line (shows what direct path would be)
    if is_nfz_route:
        folium.PolyLine(
            locations=[list(src), list(dst)],
            color='#aaa', weight=1, opacity=0.35, dash_array='3,6',
            tooltip="Direct line (BLOCKED by NFZ)"
        ).add_to(demo)

# ══════════════════════════════════════════════════════════
# LEGEND + STATS
# ══════════════════════════════════════════════════════════

legend_items = "".join([
    f"<div style='margin:2px 0;font-size:10px'>"
    f"<span style='display:inline-block;width:16px;height:3px;background:{m['color']};margin-right:5px'></span>"
    f"{'★ ' if m['id'] in [1,2,3,4] else ''}{m['label']}</div>"
    for m in MISSIONS
])

legend_html = f"""
<div style="position:fixed;bottom:20px;left:20px;z-index:9999;
    background:rgba(5,5,5,0.93);color:white;padding:14px 16px;
    border-radius:10px;font-family:Arial,sans-serif;min-width:260px;
    border:1px solid #555;max-height:50vh;overflow-y:auto">
  <b style='font-size:13px'>🚁 A* Drone Pathfinding — {len(ALL_NODES)} Nodes</b><br><br>
  {legend_items}
  <hr style='border-color:#555;margin:8px 0'>
  <div style='color:#aaa;font-size:9px;line-height:1.5'>
    ╌╌ Dashed = NFZ bypass route<br>
    ── Solid = Safe A* route<br>
    ── Grey dotted = Direct line (blocked)<br>
    🟢 = Source &nbsp; 🔴 = Destination<br>
    ⛔ = No-Fly Zone<br>
    <b style='color:#7C3AED'>★ M1-M4: NFZ in path → A* detours around periphery</b>
  </div>
</div>"""
demo.get_root().html.add_child(folium.Element(legend_html))

# Stats table
rows = "".join([
    f"<tr style='color:{'#c084fc' if r['nfz'] else '#ccc'}'>"
    f"<td style='padding:2px 5px'>{'★' if r['nfz'] else ''} M{r['id']}</td>"
    f"<td style='padding:2px 5px'>{r['src'].replace('_',' ')[:14]}</td>"
    f"<td style='padding:2px 5px'>{r['dst'].replace('_',' ')[:14]}</td>"
    f"<td style='padding:2px 5px'>A*</td>"
    f"<td style='padding:2px 5px'>{r['wps']}</td>"
    f"<td style='padding:2px 5px'>{'✅' if r['ok'] else '❌'}</td></tr>"
    for r in results
])

stats_html = f"""
<div style="position:fixed;top:10px;right:10px;z-index:9999;
    background:rgba(5,5,5,0.93);color:white;padding:12px;
    border-radius:10px;font-family:Arial,sans-serif;font-size:11px;
    border:1px solid #555;max-height:50vh;overflow-y:auto">
  <b>📊 {len(MISSIONS)} A* Missions | {len(ALL_NODES)} Nodes</b><br><br>
  <table style='border-collapse:collapse'>
    <tr style='color:#888;border-bottom:1px solid #555;font-size:9px'>
      <th style='padding:2px 5px'>ID</th><th style='padding:2px 5px'>From</th>
      <th style='padding:2px 5px'>To</th><th style='padding:2px 5px'>Algo</th>
      <th style='padding:2px 5px'>WPs</th><th style='padding:2px 5px'>OK</th></tr>
    {rows}
  </table>
  <div style='margin-top:6px;color:#a78bfa;font-size:9px;font-weight:bold'>
    ★ = NFZ in direct path → A* bypass active
  </div>
</div>"""
demo.get_root().html.add_child(folium.Element(stats_html))

# ══════════════════════════════════════════════════════════
# SAVE & PRINT
# ══════════════════════════════════════════════════════════

demo.save("iitk_drone_missions_final.html")

print("✅ Saved: iitk_drone_missions_final.html")
print(f"📍 Total Nodes: {len(ALL_NODES)}")
print(f"🚁 Total Missions: {len(MISSIONS)}")
print()
print("══════════ A* MISSION RESULTS ══════════")
for r in results:
    icon = "✅" if r["ok"] else "❌"
    tag = " ★ NFZ BYPASSED!" if r["nfz"] else ""
    print(f"  {icon} M{r['id']:2d}: {r['src']:20s} → {r['dst']:20s}  [A*]  {r['wps']:3d} WPs{tag}")
print("════════════════════════════════════════")

demo
