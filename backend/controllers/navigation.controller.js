/**
 * Controller for handling grid-based navigation requests for the tutorial.
 */

export const getGridPath = async (req, res) => {
    try {
        const { grid, start, end } = req.body;

        if (!grid || !start || !end) {
            return res.status(400).json({ error: "Missing grid, start, or end parameters" });
        }

        console.log(`Processing A* pathfinding from [${start}] to [${end}]`);

        const rows = grid.length;
        const cols = grid[0].length;

        // Helper: Manhattan Distance Heuristic
        const heuristic = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

        const openSet = [{ pos: start, g: 0, f: heuristic(start, end), parent: null }];
        const closedSet = new Set();

        let finalNode = null;

        while (openSet.length > 0) {
            // Get node with lowest f score
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();

            if (current.pos[0] === end[0] && current.pos[1] === end[1]) {
                finalNode = current;
                break;
            }

            const posKey = `${current.pos[0]},${current.pos[1]}`;
            closedSet.add(posKey);

            // Neighbors: UP, DOWN, LEFT, RIGHT
            const neighbors = [
                [current.pos[0] - 1, current.pos[1]],
                [current.pos[0] + 1, current.pos[1]],
                [current.pos[0], current.pos[1] - 1],
                [current.pos[0], current.pos[1] + 1]
            ];

            for (const neighborPos of neighbors) {
                const [r, c] = neighborPos;
                const neighborKey = `${r},${c}`;

                // Bounds & Obstacle Check
                if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] === 1 || closedSet.has(neighborKey)) {
                    continue;
                }

                const gScore = current.g + 1;
                const existingOpen = openSet.find(o => o.pos[0] === r && o.pos[1] === c);

                if (!existingOpen) {
                    openSet.push({ 
                        pos: neighborPos, 
                        g: gScore, 
                        f: gScore + heuristic(neighborPos, end), 
                        parent: current 
                    });
                } else if (gScore < existingOpen.g) {
                    existingOpen.g = gScore;
                    existingOpen.f = gScore + heuristic(neighborPos, end);
                    existingOpen.parent = current;
                }
            }
        }

        if (!finalNode) {
            return res.status(200).json({ success: false, message: "No path found" });
        }

        // Reconstruct path
        const path = [];
        let temp = finalNode;
        while (temp) {
            path.push(temp.pos);
            temp = temp.parent;
        }

        return res.status(200).json({
            success: true,
            path: path.reverse(),
            distance: path.length - 1
        });

    } catch (error) {
        console.error("Navigation Error:", error);
        res.status(500).json({ error: "Internal Server Error during pathfinding" });
    }
};
