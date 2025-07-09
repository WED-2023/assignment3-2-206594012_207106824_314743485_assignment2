require("dotenv").config();
var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipes_utils = require("./utils/recipes_utils");


router.get("/", (req, res) => res.send("im here"));

/**
 * This path return the query search results 
 */
router.get("/search", async (req, res, next) => {
  try {
    console.log('=== DEBUG: /search route called ===');
    const query  = req.query.query;
    const cuisine = req.query.cuisine;
    const diet = req.query.diet;
    const intolerances = req.query.intolerances;
    const number = req.query.number || 5;
    
    console.log('Search parameters:', { query, cuisine, diet, intolerances, number });

    const username = req.session?.username || "";
    const results = await recipes_utils.searchRecipe(query, cuisine, diet, intolerances, number, username);
    console.log(`Search returned ${results.length} results`);
    res.send(results);
  } catch (error) {
    console.error('=== ERROR in /search route ===');
    console.error('Error:', error);
    next(error);
  }
});

/**
 * This path returns 3 random recipes
 */
router.get("/random", async (req, res, next) => {
  try {
    console.log('=== DEBUG: /random route called ===');
    let recipesDetailsArray = [];
    let attempts = 0;
    const maxAttempts = 5; // To prevent infinite loops
    // const username = req.session?.username || null;

    while (recipesDetailsArray.length < 3 && attempts < maxAttempts) {
      attempts++;
      console.log(`Attempt #${attempts} to fetch ${3 - recipesDetailsArray.length} random recipes...`);
      const recipes = await recipes_utils.getRandomRecipes(3 - recipesDetailsArray.length);
      console.log('Random recipes received:', recipes?.length || 0);
      
      if (!recipes || recipes.length === 0) {
        console.log('No recipes returned from getRandomRecipes. Trying again...');
        continue;
      }

      const recipeIds = recipes.map(recipe => String(recipe.id));
      console.log('Recipe IDs:', recipeIds);
      
      for (let recipeId of recipeIds) {
        try {
          console.log(`Fetching details for recipe ID: ${recipeId}`);
          const recipeDetails = await recipes_utils.getRecipeDetails(recipeId);
          
          const username = req.session?.username;
          let wasWatched = false;
          if (username) {
            const watchedRows = await DButils.execQuery(`
              SELECT 1 FROM WatchedRecipes 
              WHERE username = '${username}' AND recipeID = '${recipeDetails.recipeID}'
              LIMIT 1
            `);
            wasWatched = watchedRows.length > 0;
          }
          recipeDetails.wasWatched = wasWatched;

          if(recipeDetails.image) { // A simple validation to check if the recipe is valid
            recipesDetailsArray.push(recipeDetails);
            console.log(`Successfully added recipe: ${recipeDetails.title}`);
          } else {
            console.log(`Recipe ID ${recipeId} is missing details, skipping.`);
          }
        } catch (error) {
          console.error(`Error fetching details for recipe ID ${recipeId}:`, error.message);
        }
        if (recipesDetailsArray.length === 3) break;
      }
    }

    if (recipesDetailsArray.length < 3) {
      console.log(`Could not fetch 3 recipes after ${maxAttempts} attempts. Sending ${recipesDetailsArray.length} recipes.`);
    }

    console.log(`Sending ${recipesDetailsArray.length} recipes to frontend`);
    res.status(200).send(recipesDetailsArray);
  } catch (error) {
    console.error('=== ERROR in /random route ===');
    console.error('Error:', error);
    next(error);
  }
});

/**
 * This path returns details of a recipe by its id - preview presentation
 */
router.get("/:recipeId", async (req, res, next) => {
  try {
    const recipeId = req.params.recipeId;
    const recipe = await recipes_utils.getRecipeDetails(recipeId);

    res.send(recipe);
  } catch (error) {
    next(error);
  }
});


router.get("/:recipeId/prepare", async (req, res, next) => {
  try {
    const recipeId = req.params.recipeId;

    // saving the recipe in req.session.mealPlan
    if (!req.session.mealPlan) req.session.mealPlan = [];

    const alreadyExists = req.session.mealPlan.find(r => r.recipeID === recipeId);
    if (!alreadyExists) {
      const newOrder = req.session.mealPlan.length + 1;
      req.session.mealPlan.push({ recipeID: recipeId, orderIndex: newOrder });
    }

    // Fetch step-by-step preparation instructions from the external Spoonacular API 
    const instructionsRaw = await recipes_utils.getAnalyzedInstructions(recipeId);
    const instructions = recipes_utils.flattenAnalyzedInstructions(instructionsRaw);


    const recipeFull = await recipes_utils.getFullRecipeFromSpoonacular(recipeId);
    const ingredients = recipeFull.ingredients;

    // Initialize session object for tracking preparation progress, if not already initialized
    if (!req.session.preparationProgress) {
      req.session.preparationProgress = {};
    }

    // Initialize progress tracking for the specific recipe if this is the first time it's accessed
    if (!req.session.preparationProgress[recipeId]) {
      req.session.preparationProgress[recipeId] = {
        completedSteps: []  //this will store indices of steps the user has marked as completed
      };
    }

    //Send both the instructions and the current progress status back to the frontend
    res.status(200).send({
      instructions: instructions,
      ingredients: ingredients,
      servings: recipeFull.servings,
      title: recipeFull.title,
      progress: req.session.preparationProgress[recipeId]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * This path returns a full recipe from Spoonacular by its ID
 */
router.get("/fullview/:recipeID", async (req, res, next) => {
  try {
    const recipeID = req.params.recipeID.trim();
    const recipe = await recipes_utils.getFullRecipeFromSpoonacular(recipeID);

    //add the recipeId for last watched
    const username = req.session.username;
    if (username) {
      await user_utils.saveWatchedRecipeToDB(username, recipeID);
    }

    res.status(200).send(recipe);
  } catch (error) {
    next(error);
  }
});


module.exports = router;
