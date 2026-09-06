const fs = require('fs');

let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// We need to add state for stats
const stateAdd = `const [books, setBooks] = useState<BookItem[]>([]);
  const [globalStats, setGlobalStats] = useState({ totalIn: 0, totalOut: 0, userActivity: {} as Record<string, number> });`;

content = content.replace("const [books, setBooks] = useState<BookItem[]>([]);", stateAdd);

// We need to update fetchData to fetch expenses
const fetchAdd = `      setBooks(fetchedBooks);
      
      let tIn = 0; let tOut = 0;
      let activity: Record<string, number> = {};
      for (const b of fetchedBooks) {
        try {
          const expSnap = await getDocs(collection(db, 'books', b.id, 'expenses'));
          expSnap.forEach(e => {
            const data = e.data();
            if (data.type === 'in') tIn += (data.amount || 0);
            else tOut += (data.amount || 0);
            const user = data.createdBy || 'Unknown';
            activity[user] = (activity[user] || 0) + 1;
          });
        } catch(e){}
      }
      setGlobalStats({ totalIn: tIn, totalOut: tOut, userActivity: activity });`;

content = content.replace("setBooks(fetchedBooks);", fetchAdd);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log("Dashboard stats logic added!");
