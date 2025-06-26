const DButils = require("./DButils");
const recipes_utils = require("./recipes_utils"); 


async function markAsFavorite(username, recipeID){
  await DButils.execQuery(`INSERT INTO FavoriteRecipes (username, recipe_id) VALUES ('${username}', '${recipeID}')`);
}

async function getFavoriteRecipes(username){
    const recipes_id = await DButils.execQuery(`select recipe_id from FavoriteRecipes where username='${username}'`);
    return recipes_id;
}

function generatingRecipeId() {
  const randomNum = Math.floor(Math.random() * 100000); 
  return `RU${randomNum}`;
}

// Function for getting a preview recipe (of any recipe- personal or  Spoonacular)
async function getPreviewForAnyRecipe(username, recipe_id) {
  try {
    if (!recipe_id) {
      console.error("getPreviewForAnyRecipe called with undefined recipe_id!");
      return null;
    }
    const recipeIDStr = recipe_id.toString();  
    console.log("Trying to get preview for recipeID:", recipeIDStr);

    
    if (recipeIDStr.startsWith("RU")) {
      let recipe = await getUserRecipeInformation(username, recipeIDStr);
      if (!recipe || recipe.error) {
        recipe = await getUserFamilyRecipeInformation(username, recipeIDStr);
      }
      if (recipe && !recipe.error) {
        return {
          recipeID: recipe.recipeID,
          title: recipe.title,
          readyInMinutes: recipe.readyInMinutes,
          image: recipe.image,
          popularity: recipe.aggregateLikes || 0,
          vegan: recipe.vegan,
          vegetarian: recipe.vegetarian,
          glutenFree: recipe.glutenFree,
          isFamily: recipe.isFamily === true || recipe.isFamily === 1
        };
      } else {
        return null;
      }
    } else {
      console.log("Calling Spoonacular API for external recipe...");
      const details = await recipes_utils.getRecipeDetails(recipeIDStr);
      console.log("Received from Spoonacular:", details);
      return {
        recipeID: details.recipeID, 
        title: details.title,
        readyInMinutes: details.readyInMinutes,
        image: details.image,
        popularity: details.aggregateLikes,
        vegan: details.vegan,
        vegetarian: details.vegetarian,
        glutenFree: details.glutenFree,
      };
    }
  } catch (error) {
    console.error("Error in getPreviewForAnyRecipe:", error);
    return null;
  }
}



// Function for creating a new recipe
async function createRecipe(username, title, readyInMinutes, image ,instructions, aggregateLikes, vegan, vegetarian, glutenFree, ingredients, servings, instructionsSteps) {
  const recipeID = generatingRecipeId(); 
  // Insert the recipe into UserRecipes table
  await DButils.execQuery(`
    INSERT INTO UserRecipes (recipeID, username, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree, instructions, servings)
    VALUES ('${recipeID}', '${username}', '${title}', ${readyInMinutes}, '${image}', ${aggregateLikes}, ${vegan}, ${vegetarian}, ${glutenFree}, '${instructions}', ${servings})
  `);

  // Insert ingredients into extendedIngredients table
  for (let ingredient of ingredients) {
    await DButils.execQuery(`
      INSERT INTO extendedIngredients (recipeID, username, ingredientName, amount, unit)
      VALUES ('${recipeID}', '${username}', '${ingredient.name}', ${ingredient.amount}, '${ingredient.unit}')
    `);
  }
  
    // Save instructions
  for (let i = 0; i < instructionsSteps.length; i++) {
    const step = instructionsSteps[i];
    const stepNumber = step.number || step.stepNumber || (i+1);
    const description = step.description || step.step;
    
    const transformedStep = {
      number: stepNumber,
      description: description
    };
    await DButils.execQuery(`
      INSERT INTO RecipeInstructions (recipeID, username, stepIndex, instructionJson)
      VALUES ('${recipeID}', '${username}', ${i}, '${JSON.stringify(transformedStep)}')
    `);
  }
  
  return recipeID;
}

// Function for creating a new family recipe
async function createFamilyRecipe(username, title, readyInMinutes, image, instructions, aggregateLikes, vegan, vegetarian, glutenFree, ingredients, servings, familyMember, occasion, instructionsSteps) {
  const recipeID = generatingRecipeId();

  await DButils.execQuery(`
    INSERT INTO UserRecipes  
    (recipeID, username, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree, instructions, servings, isFamily)
    VALUES 
    ('${recipeID}', '${username}', '${title}', ${readyInMinutes}, '${image}', ${aggregateLikes},
     ${vegan}, ${vegetarian}, ${glutenFree} , '${instructions}', ${servings}, ${true})
  `);

    await DButils.execQuery(`
    INSERT INTO FamilyRecipes   
    (recipeID, username, familyMember, occasion)
    VALUES 
    ('${recipeID}', '${username}', '${familyMember}', '${occasion}')
  `);

  for (let ingredient of ingredients) {
    await DButils.execQuery(`
      INSERT INTO extendedIngredients  
      (recipeID, username, ingredientName, amount, unit)
      VALUES ('${recipeID}', '${username}', '${ingredient.name}', ${ingredient.amount}, '${ingredient.unit}')
    `);
  }

  for (let i = 0; i < instructionsSteps.length; i++) {
    const step = instructionsSteps[i];
    const stepNumber = step.number || step.stepNumber || (i+1);
    const description = step.description || step.step;
    
    const transformedStep = {
      number: stepNumber,
      description: description
    };
    await DButils.execQuery(`
      INSERT INTO RecipeInstructions (recipeID, username, stepIndex, instructionJson)
      VALUES ('${recipeID}', '${username}', ${i}, '${JSON.stringify(transformedStep)}')
    `);
  }

  return recipeID;
}


// Function to retrieve preview of user owned recipes (just personal)
async function getUserRecipes(username) {
  try {
      const recipes = await DButils.execQuery(`
        SELECT recipeID, title, image, readyInMinutes, aggregateLikes, vegan, vegetarian, glutenFree 
        FROM UserRecipes 
        WHERE username='${username}' AND isFamily = false`);
      if (recipes.length === 0) {
          // Handle the case where no recipes are found for the user
          return { error: 'No recipes found for this user.' };
      }
      
      const watchedRows = await DButils.execQuery(`
      SELECT recipeID FROM WatchedRecipes WHERE username='${username}'
      `);
      const watchedSet = new Set(watchedRows.map(row => row.recipeID));

      const favoriteRows = await DButils.execQuery(`
      SELECT recipe_id FROM FavoriteRecipes WHERE username='${username}'
      `);
      const favoriteSet = new Set(favoriteRows.map(row => row.recipe_id));
      
      return recipes.map(recipe => ({
      ...recipe,
      isFamily: false,
      isFavorite: favoriteSet.has(recipe.recipeID),
      wasWatched: watchedSet.has(recipe.recipeID)
    }));

  } catch (error) {
      console.error('Failed to retrieve recipes:', error);
      return { error: 'Failed to retrieve recipes.' };
  }
}

// Function to retrieve user owned recipes (personal)
async function getUserRecipeInformation(username, recipe_id) {
  try {
    const recipe = await DButils.execQuery(`
      SELECT * FROM UserRecipes 
      WHERE username='${username}' 
      AND recipeID ='${recipe_id}'
      AND isFamily = false` 
    );

    console.log("Recipe details from DB:", recipe);

    if (recipe.length === 0) {
      return { error: 'Recipe does not exist for this user.' };
    }

    const ingredients = await DButils.execQuery(`
      SELECT ingredientName, amount, unit 
      FROM extendedIngredients 
      WHERE recipeID ='${recipe_id}'`
    );

    console.log("Ingredients details from DB:", ingredients);

    const favoriteRows = await DButils.execQuery(`
      SELECT recipe_id FROM FavoriteRecipes WHERE username='${username}'
    `);
    const favoriteSet = new Set(favoriteRows.map(row => row.recipe_id));
    recipe[0].isFavorite = favoriteSet.has(recipe[0].recipeID);

    recipe[0].ingredients = ingredients.length === 0 ? [] : ingredients;
    return recipe[0];
  } catch (error) {
    console.error('Failed to retrieve recipe information:', error);
    return { error: 'Failed to retrieve recipe information.' };
  }
}


async function getUserFamilyRecipeInformation(username, recipe_id) {
  try {
    // Make sure the recipe is family recipe
    const recipeRows = await DButils.execQuery(`
      SELECT * FROM UserRecipes 
      WHERE username='${username}' 
      AND recipeID ='${recipe_id}'
      AND isFamily = true`
    );

    if (recipeRows.length === 0) {
      return { error: 'Family recipe does not exist for this user.' };
    }

    const recipe = recipeRows[0];

    // ingredients retrieval
    const ingredients = await DButils.execQuery(`
      SELECT ingredientName, amount, unit 
      FROM extendedIngredients 
      WHERE recipeID ='${recipe_id}'`
    );

    recipe.ingredients = ingredients.length === 0 ? [] : ingredients;

    // Retrieving family information
    const meta = await DButils.execQuery(`
      SELECT familyMember, occasion
      FROM FamilyRecipes
      WHERE recipeID = '${recipe_id}' 
      AND username = '${username}'`
    );

    if (meta.length > 0) {
      recipe.familyMember = meta[0].familyMember;
      recipe.occasion = meta[0].occasion;
    }

    const favoriteRows = await DButils.execQuery(`
      SELECT recipe_id FROM FavoriteRecipes WHERE username='${username}'
    `);
    const favoriteSet = new Set(favoriteRows.map(row => row.recipe_id));
    recipe.isFavorite = favoriteSet.has(recipe.recipeID);

    return recipe;
  } catch (error) {
    console.error('Failed to retrieve family recipe:', error);
    return { error: 'Failed to retrieve family recipe information.' };
  }
}


// async function getUserFamilyRecipes(username) {
//   try {
//     const familyRecipes = await DButils.execQuery(`SELECT * FROM FamilyRecipes WHERE username='${username}'`);
//     return familyRecipes;
//   } catch (error) {
//     console.error('Error retrieving family recipes', error);
//     return { error: 'Error retrieving family recipes.' };
//   }
// }

async function getUserFamilyRecipes(username) {
  try {
    const familyRecipes = await DButils.execQuery(`
        SELECT recipeID, title, image, readyInMinutes, aggregateLikes, vegan, vegetarian, glutenFree 
        FROM UserRecipes 
        WHERE username='${username}' AND isFamily = true`);
  
    const watchedRows = await DButils.execQuery(`
      SELECT recipeID FROM WatchedRecipes WHERE username='${username}'
    `);
    const watchedSet = new Set(watchedRows.map(row => row.recipeID));

    const favoriteRows = await DButils.execQuery(`
      SELECT recipe_id FROM FavoriteRecipes WHERE username='${username}'
    `);
    const favoriteSet = new Set(favoriteRows.map(row => row.recipe_id));

    return familyRecipes.map(recipe => ({
      ...recipe,
      isFamily: true,
      isFavorite: favoriteSet.has(recipe.recipeID),
      wasWatched: watchedSet.has(recipe.recipeID)
    }));

  } catch (error) {
    console.error('Error retrieving family recipes', error);
    return { error: 'Error retrieving family recipes.' };
  }
}


// recipes route is using this func when the user is entering recipeID
async function saveWatchedRecipeToDB(username, recipeId) {
  // Delete if it already exists (so we can update watchedAt)
  await DButils.execQuery(`
    DELETE FROM WatchedRecipes
    WHERE username = '${username}'
    AND recipeID = '${recipeId}'
  `);

  // Re-add with current time
  await DButils.execQuery(`
    INSERT INTO WatchedRecipes (username, recipeID)
    VALUES ('${username}', '${recipeId}')
  `);
}




exports.markAsFavorite = markAsFavorite;
exports.getFavoriteRecipes = getFavoriteRecipes;
exports.createRecipe = createRecipe;
exports.getUserRecipes = getUserRecipes;
exports.getUserRecipeInformation = getUserRecipeInformation;
exports.getUserFamilyRecipes = getUserFamilyRecipes;
exports.createFamilyRecipe = createFamilyRecipe;
exports.saveWatchedRecipeToDB = saveWatchedRecipeToDB;
exports.getUserFamilyRecipeInformation = getUserFamilyRecipeInformation;
exports.getPreviewForAnyRecipe = getPreviewForAnyRecipe;
