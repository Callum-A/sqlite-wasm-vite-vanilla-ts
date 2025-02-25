import connectToDB, {
  deleteDB,
  doesDBNameAlreadyExist,
  listAllDBs,
  SqliteConnector,
} from './db-wrapper';
import { ulid } from 'ulid';

const DB_NAME = 'MyDB2.db';

const CREATE_PERSON_SQL = `
CREATE TABLE person (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL
)`;

const CREATE_DOG_SQL = `
CREATE TABLE dog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL
)`;

const peopleList = document.getElementById('people');
const dogsList = document.getElementById('dogs');

function chunkArray<T>(array: T[], size: number) {
  if (size <= 0) throw new Error('Size must be greater than zero');

  let result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

const batchInsert = async (
  db: SqliteConnector,
  tableName: string,
  rows: any[],
  batchSize: number
) => {
  const chunks = chunkArray(rows, batchSize);
  const keys = Object.keys(chunks[0][0]);
  keys.sort();
  console.log(keys);
  const colStr = keys.join(', ');
  const baseSql = `INSERT INTO ${tableName} (${colStr}) VALUES `;

  for (const chunk of chunks) {
    const params = [];
    const sqlStrings = [];
    for (const row of chunk) {
      const sqlString = '(' + '?'.repeat(keys.length).split('').join(',') + ')';
      sqlStrings.push(sqlString);
      for (const k of keys) {
        params.push(row[k]);
      }
    }

    const sql = baseSql + sqlStrings.join(', ');
    console.log('Executing', sql);
    await db.queryMany(sql, params);
    console.log('Done executing', sql);
  }
};

class Person {
  id: string;
  name: string;
  age: number;

  constructor(name: string, age: number, id?: string) {
    this.id = id ? id : ulid();
    this.name = name;
    this.age = age;
  }

  public greet() {
    console.log(`Hello ${this.name}`);
  }

  public static loadFromDB(row: any) {
    return new Person(row['name'], row['age'], row['id']);
  }

  public static async batchInsert(db: SqliteConnector, people: Person[]) {
    await batchInsert(db, 'person', people, 500);
  }
}

class Dog {
  id: string;
  name: string;
  age: number;

  constructor(name: string, age: number, id?: string) {
    this.id = id ? id : ulid();
    this.name = name;
    this.age = age;
  }

  public woof() {
    console.log(`Woof ${this.name}`);
  }

  public static loadFromDB(row: any) {
    return new Dog(row['name'], row['age'], row['id']);
  }

  public static async batchInsert(db: SqliteConnector, dogs: Dog[]) {
    await batchInsert(db, 'dog', dogs, 500);
  }
}

const main = async () => {
  let needToCreateTables = true;
  console.log(await listAllDBs());
  if (await doesDBNameAlreadyExist(DB_NAME)) {
    needToCreateTables = false;
  }
  const myDb = await connectToDB(DB_NAME);

  if (!myDb) {
    return;
  }
  if (needToCreateTables) {
    console.log('Creating tables due to initial setup');
    myDb.execute(CREATE_PERSON_SQL);
    myDb.execute(CREATE_DOG_SQL);
  }

  const peopleObjects: Person[] = [];
  for (let i = 0; i < 500; i++) {
    peopleObjects.push(new Person(i + 'Person', i));
  }

  await Person.batchInsert(myDb, peopleObjects);

  const dogObjects: Dog[] = [];
  for (let i = 0; i < 1000; i++) {
    dogObjects.push(new Dog(i + 'Dog', i));
  }

  await Dog.batchInsert(myDb, dogObjects);

  const people = await myDb.queryMany(
    'SELECT * FROM person',
    [],
    Person.loadFromDB
  );
  for (const person of people) {
    person.greet();
    const li = document.createElement('li');
    li.textContent = JSON.stringify(person);
    peopleList?.appendChild(li);
  }
  const dogs = await myDb.queryMany(
    'SELECT * FROM dog WHERE id = ?',
    [dogObjects[0].id],
    Dog.loadFromDB
  );
  for (const dog of dogs) {
    dog.woof();
    const li = document.createElement('li');
    li.textContent = JSON.stringify(dog);
    dogsList?.appendChild(li);
  }
  await myDb.close();
  await deleteDB(DB_NAME);
};

main();
