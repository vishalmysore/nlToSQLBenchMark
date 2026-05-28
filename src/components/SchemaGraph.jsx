import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

function schemaToElements(schema) {
  const elements = [];
  const tables = schema?.tables ?? [];

  for (const table of tables) {
    const colLines = table.columns
      .map((c) => `${c.name}  ${c.type}${c.isForeignKey ? " 🔗" : ""}`)
      .join("\n");
    const label = `${table.name}\n──────────\n${colLines}`;

    elements.push({
      data: {
        id: `table_${table.name}`,
        label,
        tableName: table.name,
      },
    });

    for (const col of table.columns) {
      if (col.isForeignKey && col.refTable) {
        elements.push({
          data: {
            id: `fk_${table.name}_${col.name}`,
            source: `table_${table.name}`,
            target: `table_${col.refTable}`,
            label: `${col.name} → ${col.refColumn || "id"}`,
          },
        });
      }
    }
  }
  return elements;
}

const CY_STYLE = [
  {
    selector: "node",
    style: {
      shape: "roundrectangle",
      "background-color": "#ffffff",
      "border-color": "#bae6fd",
      "border-width": 2,
      label: "data(label)",
      "text-valign": "center",
      "text-halign": "center",
      color: "#0f172a",
      "font-size": "11px",
      "font-family": "ui-monospace, SFMono-Regular, monospace",
      "text-wrap": "wrap",
      "text-max-width": "180px",
      padding: "14px",
      width: "label",
      height: "label",
      "box-shadow": "0 1px 6px rgba(0,0,0,0.08)",
    },
  },
  {
    selector: "node.highlighted",
    style: {
      "border-color": "#0ea5e9",
      "background-color": "#f0f9ff",
      "border-width": 3,
    },
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "#94a3b8",
      "target-arrow-color": "#64748b",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "arrow-scale": 1.2,
      label: "data(label)",
      "font-size": "9px",
      color: "#64748b",
      "text-background-color": "#f8fafc",
      "text-background-opacity": 1,
      "text-background-padding": "3px",
      "edge-text-rotation": "autorotate",
      "line-style": "dashed",
      "line-dash-pattern": [6, 3],
    },
  },
];

export default function SchemaGraph({ schema, highlightedTable }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  function buildCy() {
    if (!containerRef.current) return;
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }
    const elements = schemaToElements(schema);
    if (elements.length === 0) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: CY_STYLE,
      layout: {
        name: "cose",
        animate: false,
        nodeRepulsion: () => 14000,
        idealEdgeLength: () => 180,
        nodeOverlap: 20,
        gravity: 0.5,
        numIter: 1000,
        fit: true,
        padding: 40,
      },
      wheelSensitivity: 0.3,
      minZoom: 0.2,
      maxZoom: 3,
    });

    cyRef.current = cy;
  }

  useEffect(() => {
    buildCy();
    return () => { cyRef.current?.destroy(); cyRef.current = null; };
  }, [schema]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("highlighted");
    if (highlightedTable) {
      cy.getElementById(`table_${highlightedTable}`).addClass("highlighted");
    }
  }, [highlightedTable]);

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">ER Diagram</div>
      <div
        className="flex-1 rounded-xl border border-gray-200 overflow-hidden bg-gray-50"
        style={{ minHeight: 0 }}
      >
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-dashed border-slate-400" />
          Foreign Key
        </span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-400">Scroll to zoom · Drag to pan</span>
      </div>
    </div>
  );
}
