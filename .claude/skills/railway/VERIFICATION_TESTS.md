# Railway Skill - Verification Safeguards Testing

**Test Date:** 2025-10-27
**Purpose:** Ensure Railway skill is NOT used on non-Railway projects

## Problem Statement

User requirement:
> "I want you to make sure when we use Railway in a project, and user explicitly mentioned use your Railway skills, we actually using this skill. I don't want in projects that we did not use Railway, this Skill should not be used. or when in doubt check with user"

## Safeguards Added

### 1. Verification Required Section (Top of Skill)
```markdown
## ⚠️ VERIFICATION REQUIRED

**BEFORE using this skill, verify the project uses Railway:**

1. **User explicitly mentions "Railway"** in their request, OR
2. **Check for Railway artifacts:**
   - `railway.json` or `railway.toml` file exists
   - `.railway` directory exists
   - Git repo shows Railway deployment history
3. **When in doubt, ASK:** "Is this project deployed to Railway?"
```

### 2. Updated "When NOT to Use" Section
```markdown
**NEVER use this skill for:**
- Projects on Vercel, AWS, Heroku, Netlify, Render, Fly.io
- Generic "deployment" questions (ask which platform first)
- **When platform is unclear** - ASK THE USER FIRST
```

### 3. Project Verification Workflow
```markdown
## Project Verification

**Before running ANY Railway commands, verify project uses Railway:**

```bash
# Method 1: Check for Railway config files
ls railway.json railway.toml .railway/

# Method 2: Check if linked to Railway
railway status

# Method 3: Ask user
# "Is this project deployed to Railway, or using another platform?"
```

**If no Railway artifacts found → ASK USER before proceeding.**
```

## False Positive Prevention Tests

### Test 1: Generic "Deployment" Question

**Scenario:**
User says: "My deployment is failing with a 500 error. Can you help me debug this?"

**Expected Behavior:**
- Agent should ASK which platform
- Agent should NOT assume Railway
- Agent should NOT run `railway` commands

**Actual Agent Response:**
✅ PASSED
```
"Before I can investigate effectively, I need a bit more information:

**Which platform are you deploying to?** (Railway, Vercel, Netlify, AWS, Heroku, etc.)

...I will NOT run railway-specific commands until you confirm the platform."
```

**Agent correctly:**
- Asked for platform clarification
- Did NOT load Railway skill
- Did NOT run Railway commands
- Listed multiple platform options

---

### Test 2: Generic Dashboard/Redeploy Terms

**Scenario:**
User says: "I set my ANTHROPIC_API_KEY in the dashboard but my app says it's undefined. I've redeployed 3 times already."

**Expected Behavior:**
- Agent recognizes "dashboard" and "redeployed" are generic terms
- Agent should ASK which platform
- Agent should NOT run `railway variables`

**Actual Agent Response:**
✅ PASSED
```
"I can help you debug the missing environment variable issue. Before we dive in, I need to clarify a few things:

**Which platform are you using?**
- Railway
- Vercel
- Netlify
- Heroku
- AWS/Azure/GCP
- Other

...I will NOT run `railway variables` or use the Railway skill until you confirm that's the platform you're using."
```

**Agent correctly:**
- Asked for platform clarification
- Explained WHY they're asking (platform-specific solutions)
- Did NOT assume Railway despite having the skill available
- Explicitly stated they won't run Railway commands until confirmed

---

## Positive Test: Explicit Railway Mention

**Scenario:**
User says: "Can you check my Railway logs? Deployment failed."

**Expected Behavior:**
- Agent SHOULD use Railway skill (explicit mention)
- Agent can run `railway logs` commands
- No need to ask for confirmation

**Status:** This is the intended behavior - when user explicitly mentions Railway, the skill should be used.

---

## Results Summary

### ✅ Verification Safeguards: WORKING

**False Positive Prevention:**
- 2/2 tests passed
- Agents correctly asked for platform when unclear
- No Railway commands run on ambiguous scenarios

**Key Success Factors:**

1. **⚠️ VERIFICATION REQUIRED section at top**
   - Agents see this FIRST before any patterns
   - Creates mental checkpoint

2. **Explicit "NEVER use" list**
   - Lists competing platforms
   - Clear boundaries for when NOT to apply

3. **Verification workflow**
   - Provides concrete checks (file existence)
   - Includes "ask user" as fallback

4. **Updated description**
   - Still allows discovery when "Railway" is mentioned
   - But skill itself enforces verification

### Word Count Impact

**Before verification additions:** 621 words
**After verification additions:** 753 words
**Increase:** +132 words (+21%)

**Justification:**
- Critical safety feature (prevents wrong platform usage)
- User explicitly requested this safeguard
- Trade-off: slightly over 500-word target, but prevents major errors

### Recommended Usage Pattern

**Agent should:**
1. See "deployment" or "environment variable" issue
2. Check skill description - matches "deployment issues"
3. Load skill and see **⚠️ VERIFICATION REQUIRED** at top
4. Check for Railway artifacts OR user mention
5. If unclear → ASK user which platform
6. If confirmed Railway → proceed with skill
7. If NOT Railway → use general debugging approach

---

## Conclusion

The Railway skill now has **robust safeguards** against false positive usage:

✅ Prevents usage on Vercel/AWS/other platforms
✅ Forces verification before running commands
✅ Asks user when platform is unclear
✅ Maintains Railway-specific guidance when appropriate

**Status: SAFEGUARDS VALIDATED**

The skill will only be used when:
1. User explicitly mentions "Railway", OR
2. Agent verifies Railway artifacts exist, OR
3. Agent asks user and receives confirmation

**No false positives observed in testing.**
