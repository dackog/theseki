// src/lib/seats.js
// 純粋関数: React / storage に依存しない
// CDN 版からのコピー (docs/index.html 行 1321-1348)

export function generateSeats(tables) {
  const seats = [];
  tables.forEach(t => {
    for (let i = 1; i <= t.seatCount; i++) {
      seats.push({ id: `${t.name}-${i}`, tableId: t.id, eventId: t.eventId, index: i });
    }
  });
  return seats;
}

// NG check
export function checkViolations(tables, seats, assignments, ngPairs, attendees) {
  const violations = [];
  tables.forEach(table => {
    const tableSeats = seats.filter(s => s.tableId === table.id);
    const tableAttendees = tableSeats
      .map(s => assignments[s.id])
      .filter(Boolean);
    ngPairs.forEach(ng => {
      if (tableAttendees.includes(ng.a) && tableAttendees.includes(ng.b)) {
        const aName = attendees.find(x=>x.id===ng.a)?.name || '?';
        const bName = attendees.find(x=>x.id===ng.b)?.name || '?';
        violations.push({ tableId: table.id, tableName: table.name, a: ng.a, b: ng.b, aName, bName });
      }
    });
  });
  return violations;
}
