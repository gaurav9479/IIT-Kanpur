import fs from 'fs';
import { CAMPUS_NODES, CAMPUS_EDGES } from './frontend/src/config/mapConfig.js';

const nodesMap = new Map();
let nodeIdCounter = 1;

function getNodeId(lat, lng) {
    const key = `${lat.toFixed(6)}_${lng.toFixed(6)}`;
    if (!nodesMap.has(key)) {
        nodesMap.set(key, { id: `N${nodeIdCounter++}`, lat, lng });
    }
    return nodesMap.get(key).id;
}

// Map named nodes
const finalNodes = [];
for (const [name, coords] of Object.entries(CAMPUS_NODES)) {
    const id = getNodeId(coords.lat, coords.lng);
    nodesMap.get(`${coords.lat.toFixed(6)}_${coords.lng.toFixed(6)}`).name = name;
}

const finalEdges = [];
CAMPUS_EDGES.forEach(edge => {
    const fromId = getNodeId(edge[0][0], edge[0][1]);
    const toId = getNodeId(edge[1][0], edge[1][1]);
    finalEdges.push({ from: fromId, to: toId });
});

nodesMap.forEach(val => {
    finalNodes.push({
        id: val.id,
        name: val.name || `Node-${val.id}`,
        lat: val.lat,
        lng: val.lng
    });
});

const code = `// Auto-generated from mapConfig.js for backend routing validation

export const CAMPUS_NODES = ${JSON.stringify(finalNodes, null, 2)};

export const CAMPUS_EDGES = ${JSON.stringify(finalEdges, null, 2)};

export const ADJACENCY = CAMPUS_EDGES.reduce(
  (acc, edge) => {
    if (!acc[edge.from]) acc[edge.from] = [];
    if (!acc[edge.to]) acc[edge.to] = [];
    acc[edge.from].push(edge.to);
    acc[edge.to].push(edge.from); // bidirectional
    return acc;
  }, {}
);
`;

fs.writeFileSync('backend/config/campusGraph.config.js', code);
console.log('Successfully generated backend/config/campusGraph.config.js');
