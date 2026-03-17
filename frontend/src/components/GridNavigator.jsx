import React, { useState } from 'react';

const GridNavigator = () => {
  const GRID_SIZE = 10;
  
  // Grid State: 0 = empty, 1 = obstacle
  const [grid, setGrid] = useState(
    Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0))
  );
  
  const [start, setStart] = useState([0, 0]);
  const [end, setEnd] = useState([9, 9]);
  const [mode, setMode] = useState('obstacle'); // obstacle | start | end
  const [path, setPath] = useState([]); // To store the result coordinates
  const [visualizedPath, setVisualizedPath] = useState([]); // For animation
  const [loading, setLoading] = useState(false);

  const handleCellClick = (row, col) => {
    if (mode === 'obstacle') {
      const newGrid = [...grid];
      newGrid[row][col] = newGrid[row][col] === 1 ? 0 : 1;
      setGrid(newGrid);
    } else if (mode === 'start') {
      setStart([row, col]);
      setMode('obstacle'); // Switch back to obstacle mode for convenience
    } else if (mode === 'end') {
      setEnd([row, col]);
      setMode('obstacle');
    }
  };

  const clearGrid = () => {
    setGrid(Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0)));
    setPath([]);
    setVisualizedPath([]);
  };

  const handleRunAStar = async () => {
    setLoading(true);
    setPath([]); // Clear old path
    setVisualizedPath([]);

    try {
        const response = await fetch('http://localhost:5000/api/v1/navigation/grid-path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grid, start, end })
        });

        const data = await response.json();

        if (data.success) {
            setPath(data.path);
            // Animate the path reveal
            data.path.forEach((p, index) => {
                setTimeout(() => {
                    setVisualizedPath(prev => [...prev, p]);
                }, index * 50); // 50ms per step
            });
            console.log("Path found with length:", data.distance);
        } else {
            alert(data.message || "No path found!");
        }
    } catch (error) {
        console.error("Fetch error:", error);
        alert("Server connection failed. Make sure the backend is running!");
    } finally {
        setLoading(false);
    }
  };

  const getCellColor = (r, c) => {
    if (r === start[0] && c === start[1]) return 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] z-10';
    if (r === end[0] && c === end[1]) return 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)] z-10';
    
    // Check if cell is part of the visualized path
    const isVisual = visualizedPath.some(p => p[0] === r && p[1] === c);
    if (isVisual) return 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]';

    if (grid[r][c] === 1) return 'bg-navy-900';
    return 'bg-white hover:bg-navy-50';
  };

  return (
    <div className="flex flex-col items-center p-8 bg-white-soft min-h-screen">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-sora font-black text-navy-900 tracking-tighter uppercase mb-2">
          Grid Navigator <span className="text-navy-400">v1.0</span>
        </h1>
        <p className="text-navy-600 text-[10px] font-black uppercase tracking-widest">
          Interactive A* Visualization Node | Step 2: UI Foundation
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex bg-white p-2 rounded-2xl shadow-xl border border-navy-900/5 mb-8 gap-2">
        {['obstacle', 'start', 'end'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
              mode === m 
                ? 'bg-navy-900 text-white shadow-lg scale-105' 
                : 'bg-white text-navy-600 hover:bg-navy-50'
            }`}
          >
            {m} Mode
          </button>
        ))}
      </div>

      {/* Control Buttons */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={handleRunAStar}
          disabled={loading}
          className="bg-navy-900 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-navy-800 transition-all flex items-center gap-2"
        >
          {loading ? 'Calculating...' : '🚀 Run A* Pathfinding'}
        </button>
        <button
          onClick={clearGrid}
          className="bg-white text-navy-600 border border-navy-900/10 px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-navy-50 transition-all"
        >
          🧹 Clear Obstacles
        </button>
      </div>

      {/* The 10x10 Grid */}
      <div className="bg-navy-900/5 p-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white">
        <div 
          className="grid gap-1" 
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
        >
          {grid.map((row, rIdx) => 
            row.map((cell, cIdx) => (
              <div
                key={`${rIdx}-${cIdx}`}
                onClick={() => handleCellClick(rIdx, cIdx)}
                className={`w-10 h-10 border border-navy-900/5 cursor-pointer transition-all duration-300 rounded-md ${getCellColor(rIdx, cIdx)}`}
              />
            ))
          )}
        </div>
      </div>

      <div className="mt-8 flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-navy-900/5 text-[10px] font-black uppercase tracking-tighter text-navy-600">
             <div className="w-3 h-3 bg-green-500 rounded-sm"></div> Start
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-navy-900/5 text-[10px] font-black uppercase tracking-tighter text-navy-600">
             <div className="w-3 h-3 bg-red-500 rounded-sm"></div> End
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-navy-900/5 text-[10px] font-black uppercase tracking-tighter text-navy-600">
             <div className="w-3 h-3 bg-navy-900 rounded-sm"></div> Obstacle
          </div>
      </div>
    </div>
  );
};

export default GridNavigator;
