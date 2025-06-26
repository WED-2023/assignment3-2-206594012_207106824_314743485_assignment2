CREATE TABLE ExtendedIngredients (
    recipeID VARCHAR(50) NOT NULL,
    username VARCHAR(50) NOT NULL,
    ingredientName VARCHAR(255) NOT NULL,
    amount FLOAT,
    unit VARCHAR(50),
    PRIMARY KEY (recipeID, ingredientName),
    FOREIGN KEY (recipeID) REFERENCES UserRecipes(recipeID),
    FOREIGN KEY (username) REFERENCES Users(username)
);


CREATE TABLE FamilyRecipes (
  recipeID VARCHAR(50) PRIMARY KEY,
  username VARCHAR(50),
  familyMember VARCHAR(255),
  occasion VARCHAR(255),
  FOREIGN KEY (recipeID) REFERENCES UserRecipes(recipeID),
  FOREIGN KEY (username) REFERENCES Users(username)
);


CREATE TABLE FavoriteRecipes (
    username VARCHAR(50) NOT NULL,
    recipe_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (username, recipe_id),
    FOREIGN KEY (username) REFERENCES users(username)
);


CREATE TABLE RecipeInstructions (
    recipeID VARCHAR(50),
    username VARCHAR(50),
    stepIndex INT,
    instructionJson TEXT NOT NULL,
    PRIMARY KEY (recipeID, stepIndex),
    FOREIGN KEY (recipeID) REFERENCES UserRecipes(recipeID),
    FOREIGN KEY (username) REFERENCES users(username)
);

CREATE TABLE UserRecipes (
  recipeID VARCHAR(20) PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  readyInMinutes INT NOT NULL,
  image TEXT,
  aggregateLikes INT DEFAULT 0,
  vegan TINYINT(1) DEFAULT 0,
  vegetarian TINYINT(1) DEFAULT 0,
  glutenFree TINYINT(1) DEFAULT 0,
  instructions TEXT NOT NULL,
  servings INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  isFamily TINYINT(1) DEFAULT 0,
  FOREIGN KEY (username) REFERENCES users(username)
);


CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    firstname VARCHAR(50) NOT NULL,
    lastname VARCHAR(50) NOT NULL,
    country VARCHAR(100),
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    profilePic VARCHAR(500)
);


CREATE TABLE WatchedRecipes (
  username VARCHAR(255),
  recipeID VARCHAR(50),
  watchedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username, recipeID),
  FOREIGN KEY (username) REFERENCES users(username)
);
