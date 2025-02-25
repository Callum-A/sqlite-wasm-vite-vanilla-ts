import connectToDB, {
  deleteDB,
  doesDBNameAlreadyExist,
  listAllDBs,
} from './db-wrapper';

const CREATE_PERSON_SQL = `
CREATE TABLE person (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  age INTEGER NOT NULL
)`;

const CREATE_DOG_SQL = `
CREATE TABLE dog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  age INTEGER NOT NULL
)`;

const peopleList = document.getElementById('people');
const dogsList = document.getElementById('dogs');

class Person {
  name: string;
  age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  public greet() {
    console.log(`Hello ${this.name}`);
  }

  public static loadFromDB(row: any) {
    return new Person(row['name'], row['age']);
  }
}

class Dog {
  name: string;
  age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  public woof() {
    console.log(`Woof ${this.name}`);
  }

  public static loadFromDB(row: any) {
    return new Dog(row['name'], row['age']);
  }
}

const main = async () => {
  let needToCreateTables = true;
  console.log(await listAllDBs());
  if (await doesDBNameAlreadyExist('test.db')) {
    needToCreateTables = false;
  }
  const myDb = await connectToDB('test.db');

  if (!myDb) {
    return;
  }
  if (needToCreateTables) {
    console.log('Creating tables due to initial setup');
    myDb.execute(CREATE_PERSON_SQL);
    myDb.execute(CREATE_DOG_SQL);
  }

  // Gets the ID
  const row = await myDb.queryOne(
    'INSERT INTO person (name, age) VALUES (?, ?) RETURNING id',
    ['John', 24]
  );
  console.log('Got ID: ', row['id']);
  await myDb.queryOne('INSERT INTO person (name, age) VALUES (?, ?)', [
    'Sarah',
    19,
  ]);
  await myDb.queryOne('INSERT INTO dog (name, age) VALUES (?, ?)', [
    'Riley',
    4,
  ]);
  await myDb.queryOne('INSERT INTO dog (name, age) VALUES (?, ?)', [
    'Dexter',
    3,
  ]);
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
  const dogs = await myDb.queryMany('SELECT * FROM dog', [], Dog.loadFromDB);
  for (const dog of dogs) {
    dog.woof();
    const li = document.createElement('li');
    li.textContent = JSON.stringify(dog);
    dogsList?.appendChild(li);
  }
  await myDb.close();
  await deleteDB('test.db');
};

main();
