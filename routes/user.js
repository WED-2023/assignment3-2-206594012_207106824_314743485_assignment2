var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipe_utils = require("./utils/recipes_utils");

console.log("Loaded API Key:", process.env.spooncular_apiKey);


/**
 * Authenticate all incoming requests by middleware
 */
router.use(async function (req, res, next) {
  if (req.session && req.session.username) {
    DButils.execQuery("SELECT username FROM users").then((users) => {
      if (users.find((x) => x.username === req.session.username)) {
        req.username = req.session.username;
        next();
      }
    }).catch(err => next(err));
  } else {
    res.sendStatus(401);
  }
});


/**
 * This path gets body with recipeId and save this recipe in the favorites list of the logged-in user
 */
router.post('/favorites', async (req,res,next) => {
  try{
    const username = req.session.username;
    const recipeID = req.body.recipeID;
    await user_utils.markAsFavorite(username,recipeID);
    res.status(200).send("The Recipe successfully saved as favorite");
    } catch(error){
    next(error);
  }
})

/**
 * This path returns the favorites recipes that were saved by the logged-in user
 */
router.get('/favorites', async (req,res,next) => {
  try{
    const username = req.session.username;
    //let favorite_recipes = {};
    const recipes_id = await user_utils.getFavoriteRecipes(username);
    let recipes_id_array = [];
    recipes_id.map((element) => recipes_id_array.push(element.recipe_id)); //extracting the recipe ids into array

    // Fetch watched recipes for this user
    const watchedRows = await DButils.execQuery(`
      SELECT recipeID FROM WatchedRecipes WHERE username='${username}'
    `);
    const watchedSet = new Set(watchedRows.map(row => row.recipeID));

    const results = await Promise.all(
      recipes_id_array.map(async (id) => {
        try {
          const preview = await user_utils.getPreviewForAnyRecipe(username, id);
          if (preview) {
            return {
              ...preview,
              isFavorite: true,
              wasWatched: watchedSet.has(id)
            };
          }
          return null;
        } catch (e) {
          console.error(`Error loading recipe ${id}:`, e);
          return null;
        }
      })
    );

    const filteredResults = results.filter(Boolean);
    res.status(200).send(filteredResults);
  } catch (error) {
    next(error);
  }
});


/**
 * The path allows a logged-in user to create new recipe
 */

router.post('/recipes', async (req, res, next) => {
  try {
    const username = req.session.username;
    const { 
      title, image, readyInMinutes, vegan, vegetarian, glutenFree, 
      ingredients, instructions, instructionsSteps, servings, 
      isFamily, familyMember, occasion 
    } = req.body;

    const aggregateLikes = 0; 

    // Validate inputs
    if (!title || !image || !readyInMinutes || instructions.length === 0 || instructionsSteps.length === 0 || !ingredients || !servings) {
      return res.status(400).send({ message: "Missing required field" });
    }

    // Create the recipe
    let recipe_id;
    if (isFamily) {
      if (!familyMember || !occasion) {
        return res.status(400).send({ message: "Missing family metadata" });
      }
      recipe_id = await user_utils.createFamilyRecipe(username, title, readyInMinutes, image,
        instructions, aggregateLikes, vegan, vegetarian, glutenFree, ingredients, servings,
        familyMember, occasion, instructionsSteps);
    } else {
      recipe_id = await user_utils.createRecipe(username, title, readyInMinutes, image,
        instructions, aggregateLikes, vegan, vegetarian, glutenFree, ingredients, servings, instructionsSteps);
    }

    res.status(201).send({ message: "Recipe created successfully", recipe_id });
  } catch (error) {
    next(error);
  }
});


/**
 * The path returns the preview recipes created by the logged-in user (his personal recipes)
 */
router.get('/my-recipes', async (req, res, next) => {
  try {
    const username = req.session.username;
    console.log('Fetching recipes for user:', username);
    const recipes = await user_utils.getUserRecipes(username);
    if (!recipes || recipes.length === 0) {
      return res.status(404).send({ message: 'No recipes found for this user' });
    }
    res.status(200).send(recipes);
  } catch (error) {
    next(error);
  }
});

/**
 * The path returns a full view of a user's recipe by its recipeId 
 */
router.get("/my-recipes/:recipeId", async (req, res, next) => {
  try {
    const username = req.session.username;
    const usernameRecipeId = req.params.recipeId.trim(); 
    if (username) {
      await user_utils.saveWatchedRecipeToDB(username, usernameRecipeId);
    }
    const userRecipe = await user_utils.getUserRecipeInformation(username,usernameRecipeId);
    res.status(200).send(userRecipe);
  } catch (error) {
    next(error);
  }
});


/**
 * The path returns a full view of a user's family recipe by its recipeId 
 */
router.get("/family-recipes/:recipeId", async (req, res, next) => {
  try {
    const username = req.session.username;
    const recipeId = req.params.recipeId.trim();

    if (username) {
      await user_utils.saveWatchedRecipeToDB(username, recipeId);
    }

    const familyRecipe = await user_utils.getUserFamilyRecipeInformation(username, recipeId);
    if (familyRecipe.error) {
      return res.status(404).send({ message: familyRecipe.error });
    }

    res.status(200).send(familyRecipe);
  } catch (error) {
    next(error);
  }
});


/**
 * The path returns the preview family recipes created by the logged-in user
 */
router.get('/family-recipes', async (req, res, next) => {
  try {
    const username = req.session.username;
    const familyRecipes = await user_utils.getUserFamilyRecipes(username);

    if (!familyRecipes || familyRecipes.length === 0) {
      return res.status(404).send({ message: 'No family recipes found for this user' });
    }

    const previews = familyRecipes.map((recipe) => ({
      recipeID: recipe.recipeID,
      title: recipe.title,
      image: recipe.image,
      readyInMinutes: recipe.readyInMinutes,
      popularity: recipe.aggregateLikes,
      vegan: recipe.vegan,
      vegetarian: recipe.vegetarian,
      glutenFree: recipe.glutenFree,
      isFamily: recipe.isFamily,
      isFavorite: recipe.isFavorite,
      wasWatched: recipe.wasWatched
    }));

    res.status(200).send(previews);
  } catch (error) {
    next(error);
  }
});

/**
 * The path returns the 3 last watched recipes by the user
 */
router.get("/recipes/watched", async (req, res, next) => {
  try {
    const username = req.session.username;
    const watchedRows = await DButils.execQuery(`
      SELECT recipeID
      FROM WatchedRecipes
      WHERE username = '${username}'
      ORDER BY watchedAt DESC
      LIMIT 3
    `);

    console.log("Raw watchedRows:", watchedRows);

    const recipeIds = watchedRows
      .map(row => row.recipeID?.toString().trim())
      .filter(id =>
        id &&
        id !== 'watched' &&
        id !== 'undefined' &&
        id !== 'null'
    );

    console.log("Filtered recipe IDs:", recipeIds);

    const favoriteRows = await DButils.execQuery(`
      SELECT recipe_id FROM FavoriteRecipes WHERE username='${username}'
    `);
    const favoriteSet = new Set(favoriteRows.map(row => row.recipe_id));

    const watchedRecipes = await Promise.all(recipeIds.map(async (id) => {
      try {
        // attempt from the User DB
        const userRecipe = await DButils.execQuery(`
          SELECT recipeID, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree
          FROM UserRecipes
          WHERE recipeID = '${id}'
        `);
        if (userRecipe.length > 0) {
            return {
              ...userRecipe[0],
              wasWatched: true,
              isFavorite: favoriteSet.has(id)
          };
        }
        // attempt from spoonacular 
        const apiRecipe = await recipe_utils.getRecipeDetails(id);
        return {
          ...apiRecipe,
          wasWatched: true,
          isFavorite: favoriteSet.has(id)
        };
      } catch (e) {
        return null; 
      }
    }));

    // Filtering failed recipes
    const validRecipes = watchedRecipes.filter(Boolean);
    res.status(200).send(validRecipes);
  } catch (error) {
    next(error);
  }
});

/**
 * The path enables the user to mark in the recipe a preparation step as completed- both recipes from website or personal/family
 */
router.post("/recipes/:recipeId/prepare/step", (req, res) => {
  const recipeId = req.params.recipeId;
  // Extract the step index (which step the user completed) from the request body
  const { stepIndex } = req.body;

  // Check if the user's session has preparation progress initialized for this recipe
  // preparationProgress intialized under recipes route- when he wants making from the website 
  // and also initialized when he wants making from his own recipes
  if (!req.session.preparationProgress || !req.session.preparationProgress[recipeId]) {
    return res.status(400).send({ message: "Preparation not started" });
  }

  // Prevent duplicates: check if the step was already marked as completed
  const alreadyMarked = req.session.preparationProgress[recipeId].completedSteps.includes(stepIndex);
  if (!alreadyMarked) {
    // Add the completed step index to the progress tracking array
    req.session.preparationProgress[recipeId].completedSteps.push(stepIndex);
  }

  // Respond with success message
  res.status(200).send({ message: "Step marked as completed." });
});


/**
 * The path returns both the preparation steps and the current progress of the user owned personal recipes
 */
router.get("/my-recipes/:recipeId/prepare", async (req, res, next) => {
  try {
    const recipeId = req.params.recipeId;
    const username = req.session.username;

    // saving the recipe in req.session.mealPlan
    if (!req.session.mealPlan) req.session.mealPlan = [];

    const alreadyExists = req.session.mealPlan.find(r => r.recipeID.toString() === recipeId.toString());
    if (!alreadyExists) {
      const newOrder = req.session.mealPlan.length + 1;
      req.session.mealPlan.push({ recipeID: recipeId, orderIndex: newOrder });
    }

    // Query the DB to get the ordered list of steps for this recipe
    const steps = await DButils.execQuery(`
    SELECT R.stepIndex, R.instructionJson
    FROM RecipeInstructions R
    JOIN UserRecipes U ON R.recipeID = U.recipeID
    WHERE R.recipeID = '${recipeId}'
      AND R.username = '${username}'
      AND U.isFamily = false
    ORDER BY R.stepIndex ASC
    `);

    if (!steps || steps.length === 0) {
      return res.status(404).send({ message: "No preparation steps found for this recipe." });
    }

    const parsedSteps = steps.map(step => {
      const parsed = JSON.parse(step.instructionJson);
      return {
        number: parsed.number || parsed.stepNumber || parsed.step || 1,  // מוודאים שיהיה מספר שלב
        description: parsed.description || parsed.step || ""
      };
    });

    // Load ingredients for this recipe
    const ingredients = await DButils.execQuery(`
      SELECT ingredientName, amount, unit 
      FROM extendedIngredients 
      WHERE recipeID = '${recipeId}'
    `);

    const parsedIngredients = ingredients.map(ing => ({
      name: ing.ingredientName,
      amount: ing.amount,
      unit: ing.unit
    }));

    // Load servings and title (from UserRecipes)
    const recipe = await DButils.execQuery(`
      SELECT servings, title 
      FROM UserRecipes 
      WHERE recipeID = '${recipeId}' 
      AND username = '${username}'
    `);

    if (recipe.length === 0) {
      return res.status(404).send({ message: "Recipe not found." });
    }

    // Initialize the session object for tracking step progress, if needed
    if (!req.session.preparationProgress) {
      req.session.preparationProgress = {};
    }

    // If this is the first time this recipe is being prepared, initialize it
    if (!req.session.preparationProgress[recipeId]) {
      req.session.preparationProgress[recipeId] = { completedSteps: [] };
    }

    res.status(200).send({
      instructions: parsedSteps,
      progress: req.session.preparationProgress[recipeId],
      ingredients: parsedIngredients,
      servings: recipe[0].servings,
      title: recipe[0].title
    });
  } catch (error) {
    next(error);
  }
});

/**
 * The path returns preparation steps for a user's family recipe
 */
router.get("/family-recipes/:recipeId/prepare", async (req, res, next) => {
  try {
    const recipeId = req.params.recipeId;
    const username = req.session.username;

    // saving the recipe in req.session.mealPlan
    if (!req.session.mealPlan) req.session.mealPlan = [];

    const alreadyExists = req.session.mealPlan.find(r => r.recipeID.toString() === recipeId.toString());
    if (!alreadyExists) {
      const newOrder = req.session.mealPlan.length + 1;
      req.session.mealPlan.push({ recipeID: recipeId, orderIndex: newOrder });
    }

    // Query the DB to get the ordered list of steps for this recipe
    const steps = await DButils.execQuery(`
    SELECT R.stepIndex, R.instructionJson
    FROM RecipeInstructions R
    JOIN UserRecipes U ON R.recipeID = U.recipeID
    WHERE R.recipeID = '${recipeId}'
      AND R.username = '${username}'
      AND U.isFamily = true
    ORDER BY R.stepIndex ASC
    `);

    if (!steps || steps.length === 0) {
      return res.status(404).send({ message: "No preparation steps found for this family recipe." });
    }

    const parsedSteps = steps.map(step => {
      const parsed = JSON.parse(step.instructionJson);
      return {
        number: parsed.number || parsed.stepNumber || parsed.step || 1,
        description: parsed.description || parsed.step || ""
      };
    });

    // Load ingredients
    const ingredients = await DButils.execQuery(`
      SELECT ingredientName, amount, unit 
      FROM extendedIngredients 
      WHERE recipeID = '${recipeId}'
    `);
    const parsedIngredients = ingredients.map(ing => ({
      name: ing.ingredientName,
      amount: ing.amount,
      unit: ing.unit
    }));

    // Load title + servings
    const recipeRows = await DButils.execQuery(`
      SELECT servings, title 
      FROM UserRecipes 
      WHERE recipeID = '${recipeId}' AND username = '${username}'
    `);

    if (recipeRows.length === 0) {
      return res.status(404).send({ message: "Recipe not found." });
    }

    // Initialize the session object for preparation progress tracking
    if (!req.session.preparationProgress) {
      req.session.preparationProgress = {};
    }

    // If the progress for this recipe doesn't exist yet, initialize it
    if (!req.session.preparationProgress[recipeId]) {
      req.session.preparationProgress[recipeId] = {
        completedSteps: [] // Tracks step indices the user has completed
      };
    }

    // Send both the instructions and the current progress status
    res.status(200).send({
      instructions: parsedSteps,
      progress: req.session.preparationProgress[recipeId],
      ingredients: parsedIngredients,
      servings: recipeRows[0].servings,
      title: recipeRows[0].title
    });

  } catch (error) {
    next(error);
  }
});


/**
 * Get the user's current meal plan (fully improved version with step count)
 */
router.get("/meal-plan", async (req, res) => {
  if (!req.session.username) {
    return res.status(401).send({ message: "Unauthorized - not logged in" });
  }

  const mealPlan = req.session.mealPlan || [];
  const username = req.session.username;

  if (mealPlan.length === 0) {
    return res.send([]);
  }

  const enrichedMealPlan = await Promise.all(
    mealPlan.map(async (item) => {
      try {
        const recipeIDStr = (item.recipeID || item.recipeId).toString();

        const preview = await user_utils.getPreviewForAnyRecipe(username, recipeIDStr);
        if (!preview) {
          return {
            recipeID: recipeIDStr,
            orderIndex: item.orderIndex,
            title: "Unknown Recipe",
            image: "",
            readyInMinutes: 0,
            vegan: false,
            vegetarian: false,
            glutenFree: false,
            popularity: 0,
            totalSteps: 0,
            progress: { completedSteps: [] }
          };
        }

        let totalSteps = 0;
        if (recipeIDStr.startsWith("RU")) {
          // personal/family recipe
          const stepsRows = await DButils.execQuery(`
            SELECT COUNT(*) as stepCount FROM RecipeInstructions 
            WHERE recipeID = '${recipeIDStr}' AND username = '${username}'
          `);
          totalSteps = stepsRows[0].stepCount;
        } else {
          // Spoonacular recipe
          totalSteps = await recipe_utils.getNumberOfInstructionsFromSpoonacular(recipeIDStr);
        }

        return {
          recipeID: recipeIDStr,
          orderIndex: item.orderIndex,
          title: preview.title,
          image: preview.image,
          readyInMinutes: preview.readyInMinutes,
          vegan: preview.vegan,
          vegetarian: preview.vegetarian,
          glutenFree: preview.glutenFree,
          popularity: preview.popularity, 
          totalSteps: totalSteps,
          progress: req.session.preparationProgress?.[recipeIDStr] || { completedSteps: [] }
        };
      } catch (error) {
        console.error(`Error enriching recipe ${item.recipeID}:`, error);
        return {
          recipeID:  (item.recipeID || item.recipeId).toString(),
          orderIndex: item.orderIndex,
          title: "Unknown Recipe",
          image: "",
          readyInMinutes: 0,
          vegan: false,
          vegetarian: false,
          glutenFree: false,
          popularity: 0,
          totalSteps: 0,
          progress: { completedSteps: [] }
        };
      }
    })
  );

  res.send(enrichedMealPlan);
});

/**
 * Add a recipe to the user's meal plan
 */
router.post("/meal-plan", (req, res) => {
  if (!req.session.username) {
    return res.status(401).send({ message: "Unauthorized - not logged in" });
  }

  const { recipeID } = req.body;
  if (!req.session.mealPlan) req.session.mealPlan = [];

  // check if already existed
  if (req.session.mealPlan.find(r => r.recipeID.toString() === recipeID.toString())) {
    return res.status(200).send({ message: "Already in meal plan" });
  }

  // To number the next recipe that enters the meal
  const newOrder = req.session.mealPlan.length + 1;
  req.session.mealPlan.push({ recipeID, orderIndex: newOrder });

  res.status(200).send({ message: "Added to meal plan" });
});


/**
 * Update the order of a recipe in the meal plan
 */
router.patch("/meal-plan/:recipeID", (req, res) => {
  console.log("Received PATCH request to /meal-plan/:recipeID");

  if (!req.session.username) {
    console.log("No username in session");
    return res.status(401).send({ message: "Unauthorized - not logged in" });
  }

  const recipeID = req.params.recipeID;
  const { orderIndex } = req.body;

  console.log("Requested recipeID:", recipeID);
  console.log("New orderIndex:", orderIndex);

  if (!req.session.mealPlan) {
    console.log("No meal plan found in session");
    return res.status(400).send({ message: "Meal plan is empty" });
  }

  // Sort by existing order
  let sortedPlan = [...req.session.mealPlan].sort((a, b) => a.orderIndex - b.orderIndex);
  console.log("Current sorted meal plan:", sortedPlan);


  // Find the recipe and remove it from its current index
  const itemIndex = sortedPlan.findIndex(r => r.recipeID == recipeID);
  if (itemIndex === -1) {
    console.log("Recipe not found in meal plan:", recipeID);
    return res.status(404).send({ message: "Recipe not found in meal plan" });
  }

  const [movedItem] = sortedPlan.splice(itemIndex, 1);

  // Add it in the new index (note: orderIndex starts at 1)
  const insertIndex = Math.max(0, Math.min(orderIndex - 1, sortedPlan.length));
  sortedPlan.splice(insertIndex, 0, movedItem);

  // Renumbering
  sortedPlan = sortedPlan.map((r, idx) => ({
    ...r,
    orderIndex: idx + 1
  }));

  req.session.mealPlan = sortedPlan;

  res.status(200).send({ message: "Order updated successfully" });
});


/**
 * Remove a recipe from the meal plan
 */
router.delete("/meal-plan/:recipeID", (req, res) => {
  if (!req.session.username) {
  return res.status(401).send({ message: "Unauthorized - not logged in" });
}

  if (!req.session.mealPlan) return res.sendStatus(204);

  // Filter the recipe we' want to delete
  req.session.mealPlan = req.session.mealPlan.filter(r => r.recipeID !== req.params.recipeID);
  
  // Renumbers the order
  req.session.mealPlan = req.session.mealPlan.map((r, idx) => ({
    ...r,
    orderIndex: idx + 1
  }));
  
  res.send({ message: "Removed" });
});


/**
 * Clear the entire meal plan
 */
router.delete("/meal-plan", (req, res) => {
  if (!req.session.username) {
  return res.status(401).send({ message: "Unauthorized - not logged in" });
}

  req.session.mealPlan = [];
  res.send({ message: "Meal plan cleared" });
});



module.exports = router;
