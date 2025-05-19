import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  DragEndEvent,
  useDroppable,
  type SensorDescriptor,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

// Define your resource shape
interface Resource {
  id: string;
  label: string;
  type: string;
}

// Initial demo data: replace with your API-loaded data
const initialResources: { [columnId: string]: Resource[] } = {
  available: [
    { id: "r1", label: "Team Leader", type: "PERSONNEL" },
    { id: "r2", label: "4x4 Vehicle", type: "VEHICLE" },
    { id: "r3", label: "Medical Pack", type: "MEDICAL_PACK" },
  ],
  teamA: [],
  teamB: [],
};

// A draggable "strip"
function SortableStrip({ resource }: { resource: Resource }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: resource.id });
  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 mb-2 bg-gray-100 rounded shadow cursor-pointer"
    >
      {resource.label}
    </div>
  );
}

// A droppable column
function DroppableColumn({ id, items }: { id: string; items: Resource[] }) {
  const { setNodeRef } = useDroppable({ id, data: { columnId: id } });

  return (
    <div ref={setNodeRef} className="bg-white p-4 rounded shadow">
      <h2 className="font-bold mb-2 capitalize">{id}</h2>
      <SortableContext
        items={items.map((r) => r.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((resource) => (
          <SortableStrip key={resource.id} resource={resource} />
        ))}
      </SortableContext>
    </div>
  );
}

const App: React.FC = () => {
  const [columns, setColumns] = useState(initialResources);

  // Static sensor descriptor; no hooks called before context
  const sensors: SensorDescriptor<any>[] = [
    { sensor: PointerSensor, options: {} },
  ];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const fromColumn = Object.keys(columns).find((col) =>
      columns[col].some((res) => res.id === active.id)
    );
    const toColumn = over.data.current?.columnId;
    if (!fromColumn || !toColumn) return;

    if (fromColumn === toColumn) {
      const oldIdx = columns[fromColumn].findIndex((r) => r.id === active.id);
      const newIdx = columns[fromColumn].findIndex((r) => r.id === over.id);
      setColumns({
        ...columns,
        [fromColumn]: arrayMove(columns[fromColumn], oldIdx, newIdx),
      });
    } else {
      const moving = columns[fromColumn].find((r) => r.id === active.id)!;
      setColumns({
        ...columns,
        [fromColumn]: columns[fromColumn].filter((r) => r.id !== active.id),
        [toColumn]: [...columns[toColumn], moving],
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-3 gap-4 p-4">
        {Object.entries(columns).map(([colId, items]) => (
          <DroppableColumn key={colId} id={colId} items={items} />
        ))}
      </div>
    </DndContext>
  );
};

export default App;
