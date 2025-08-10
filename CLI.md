# ppp cli tool

ppp (Product Prompt Planner) is command line tool which is used to manage features and product backlog, and track sprint backlogs including stories, tasks and bugs using well-structured folders and well-documented markdown files for ai assist tools like cursor , trae and claude code as effective task prompts.

**Key Features:**
- **Hierarchical Issue Management**: 3-layer feature structure with tasks and bugs
- **Robust Folder System**: Finds folders by ID prefix, resilient to manual renames
- **Unicode Support**: Full support for Chinese and international characters
- **Sprint Management**: Complete sprint lifecycle with issue tracking
- **Database Integration**: YAML metadata with markdown content files
- **AI Integration**: MCP server for seamless AI assistant workflows

**Common Concepts:**
- **Project Object**: the abstract super object that generically represents all the objects for the project management including Products, Releases, Sprints, Issues (Features, Stories, Tasks, Bugs) and so on. Each Project Object has Object Record and Object Folder.
- **Object Record**: a record represents the structured data part of an Project Object and is stored in a database.yml file (as a yaml file database) in the .ppp project folder. the object record is used for object indexing, searching, status tracking, and facilitating for command line operations. the fields in Object Record are not supposed to be modified in the main markdown file (mainly spec.md ) in the object folder because the information in the main markdown file cannot be easily synced back to object record stored in database.yml file. the fields in Object Record are supposed to be modified only by command line operations.
- **Object Folder**: a folder represents the unstructured data part of an Project Object that contains all the files and folders related to an Project Object for the project management. It is stored in the .ppp project folder. the spec file in the folder will be fed to LLM/Coding Assist(Claude Code/Cursor/Trae) as a well-described task prompt for coding. the spec file in the folder is the main file for the project object. all the information in the spec file is used for LLM/Coding Assist/AI Agents as user prompt.
- **Object ID**: unique identifier for an object. it is always with a suffix to distinguish different types of objects plus a fixed digits populated by increment number backed by counters in database.yml file. it is used for object indexing, folder locating and status tracking. it is also used for object folder name and object record file name.

**Common Rules:**
- **Object ID Normalization**: All Object IDs must be stored and processed in uppercase format throughout the system. This includes:
  - Issue IDs (F01, T010101, B010101) 
  - Sprint IDs (S01, S02)
  - Parent-child relationships (parent_id field)
  - User input in commands must be normalized to uppercase before processing
  - Database storage and comparisons use uppercase format
  - Object IDs are always generated with uppercase suffix character (which represents an Object Type)
  - When using Object ID in commands, it needs to be converted to uppercase so that the input object ID can match the stored object IDs in database

- **Database as Single Source of Truth**: All operations use the database for counting and logic. This ensures:
  - All sprint/issue operations query database for accurate counts and relationships
  - Command outputs (like sprint list) display real-time data from database
  - Consistent data across all operations regardless of file system state
  - Bidirectional relationships (sprint-issue) maintained accurately in database

- **Automatic File Sync**: Database changes trigger file system updates to maintain consistency. This includes:
  - Spec.md files automatically updated after database operations
  - Symlinks created/removed based on database state
  - Markdown content reflects current database relationships
  - **Folder names updated** when issue names change via issue update command
  - **Children sections** automatically updated in parent issue files
  - **Bidirectional relationships** maintained between issues and sprints
  - Real-time synchronization ensures file system always matches database state

## Building Blocks
All PPP features are built on top of following building blocks:

### Config
**Config** is the building block that contains all the ppp settings. It is stored in `~/.ppp/settings.json` file. Users can configure their ppp settings in this file or by running `ppp config` command. Here are all the config items and their default values:
- llm_api_key: ""
- llm_api_url: "https://api.moonshot.cn/v1"
- llm_api_model: "kimi-k2-0711-preview"
- llm_api_temperature: 0.7
- llm_api_max_tokens: 1000
- llm_api_top_p: 1

### Issue
**Issue** is the abstraction of any work item in the product backlog. It can be a module/feature, a task, a bug, a story, etc. All the detailed information about an issue is in its **Issue File** which is in the issue's parent folder, or in a **Issue Folder** which is in the issue's parent folder. Whether or not being in the **Issue Folder** depends on the issue type.

1. **Issue Attributes**
- **Issue ID**: Unique identifier for the issue.
- **Issue Type**: Module/Feature, User Story, Task, Bug, etc.
- **Issue Status**: New, In Progress, Done, etc.
- **Issue Priority**: High, Medium, Low, etc.
- **Issue Assignee**: Person responsible for the issue.
- **Issue Reporter**: Person who reported the issue.
- **Issue Labels**: Tags to categorize the issue.
- **Issue Description**: Detailed description of the issue.
- **Issue Comments**: Comments related to the issue.

2. **Issue ID** is unique identifier for an issue and is generated by ppp when issue is created. It  not only reference an issue in other ppp features (sprint tracking) but also generate markdown files name and folder names for the types of issue prompt documents. Here are the Issue ID generation rules by Issue Types:

  - **Prefix Char Meaning** These prefix characters are used to categorize the issue type by ppp and devs. As of now, they are fixed and maybe configurable in future. In terms of an issue's type, the issue ID is prefixed with following characters:
    - **Feature**: F
    - **User Story/Task**: T
    - **Bug**: B

  - **Rules of Issue ID Generation**
    1. **Common Rules**:
      - **ID Number Increment**: the ID digit part increases from 1, not 0. i.e. F01, F1101, the F00 and F1100 is prohibitive and reserved.
      - **Fixed Digits**: F01, F0101 and F010101 are legal, but F1, F011 and F01011 are illegal.

    2. **Feature ID**: Features are fixed to be in 3 layers:
      - layer 1 feature IDs gos with prefix plus 2-fixed-digits like F01, F02, ... F99. The F prefix means feature, the 2-digits means layer 1 features (the top-level feature).
      - layer 2 feature IDs gos with prefix plus 4-fixed-digits like F0101, F0101, .. F0199, F1201, F1202, ...F1299. The F prefix means feature, the first 2 digits is an internal ID part that means it is under the layer 1 features (the top-level feature), the last 2 digits is an internal ID part in it parent feature (layer 1 feature).
      - layer 3 feature IDs gos with prefix plus 6-fixed-digits like F010101, F010102, ...F010199, F010105, F120201. The F prefix means feature, the first 2 digits means it is under a specific layer 1 feature, the second 2-digits is an internal ID part that means it is under a specific layer 2 feature, the last 2 digits is an internal ID part in its parent layer 2 feature.

    3. **User Story/Task ID**: The type of issues must be put under a specific feature doc folder and ID must be prefixed with a specific feature ID's digits part, and also be suffixed with an auto-incremented 2-digits number. i.e. if a user story belongs to a feature F0105, The user story ID goes like T010501, "0105" mean the user story belongs to feature F0105. if a user story belongs to feature F01, The user story ID goes like T0101, "01" mean the user story belongs to feature F01.

    4. **Bug ID**: Bugs must be put under a specific feature doc folder and ID must be prefixed with a specific feature/User Story/Task ID's digits part, and also be suffixed with an auto-incremented 2-digits number as what User Story/Task ID does. i.e. if a bug belongs to a feature F0105, The bug ID goes like B010501, "0105" mean the bug belongs to feature B0105. if a bug belongs to feature T010101, The bug ID goes like B010101, "01" mean the bug belongs to feature F0101.

  - **ID Generation System**: PPP uses a counter-based ID generation system that maintains auto-incrementing counters for each issue type and hierarchy level. The counters are stored in the `.ppp/database.yml` file and are automatically updated when new issues are created. This ensures unique IDs and prevents conflicts even when issues are created concurrently or when the file system is modified externally.

  - **Folder Location System**: PPP uses a robust hierarchical folder location system that dynamically computes folder locations using stable issue IDs rather than folder names. Key robustness features:

    **Core Rules:**
    - **Stable Issue ID Prefix**: Folders are found by issue ID prefix (e.g., `F01-`, `T010101-`), not by the descriptive suffix
    - **Case-Insensitive Matching**: Issue IDs work regardless of case (`f01`, `F01`, `F01` all match the same issue)
    - **Flexible Naming**: Users can rename the descriptive part after the dash freely (e.g., `F01-old_name` → `F01-new_better_name`)
    - **Prefix-Based Search**: System searches for folders starting with `{issueId}-` pattern, ignoring what comes after the dash

    **What This Means:**
    - ✅ Safe: Rename `F01-user_auth` to `F01-authentication_system`
    - ✅ Safe: Use any case in commands (`ppp issue update f01` or `ppp issue update F01`)
    - ❌ Never change: The issue ID prefix before the dash (`F01-` must stay `F01-`)

  - **Issue ID Matching**: PPP uses case-insensitive matching when searching for or referencing issue IDs. This means that `f01`, `F01`, and `F01` are all treated as the same issue ID. Users can use lowercase, uppercase, or mixed case when specifying issue IDs in commands, and PPP will automatically find the correct issue. For example:
    - `ppp issue update f01 "New Name"` (lowercase)
    - `ppp issue update F01 "New Name"` (uppercase)
    - `ppp sprint add f01 01` (lowercase issue ID)
    - `ppp sprint add F01 01` (uppercase issue ID)
    All of these commands will work with the same issue `F01`.


3. **Issue Name** is assigned by ppp user when issue is created. and its **Name Keywords** is generated by ppp (which will use LLM API to generate keywords from issue name configured by user in settings.json file in the future) and used by issue filing as file name.
  - **Name Keywords** is a list of keywords that are generated from issue name in course of issue filing. PPP supports Unicode characters including Chinese text with specialized processing to preserve all international characters in issue names and keywords.
  - **Issue Filing** is the course of issue creation. It includes issue file/folder name, issue file/folder content which will include issue ID, name, description, issue type, issue priority, issue assignee, issue reporter, issue labels, issue comments, etc.

4. **Issue File** is the file that contains all the issue related info. It is created when issue is created and managed by ppp during issue lifetime. **All issues create folders** for extensibility and consistency.
- Features: Its path is like `.ppp/<issue_folder>/spec.md`. i.e. `F01-admin/spec.md`, `F01-admin/F02-user_management/spec.md`, etc. It should includes all the issue attributes and other details of requirement and implementation in the md file.
- User Stories/Tasks: Its path is like `.ppp/<feature_folder>/<feature_folder>/<task_folder>/spec.md`. i.e. `F01-admin/T01-create_admin_ddl/spec.md`, `F01-admin/F01-user_management/T03-add_user/spec.md` and `F01-admin/F01-user_management/F02-add_user/T05-check_username/spec.md`. It should includes all the issue attributes and other details related the issue type in the md file.
- Bugs: Its path is like `.ppp/<feature_folder>/<feature_or_task_folder>/<bug_folder>/spec.md`. i.e. `F01-admin/F01-user_management/B03-cannot_load_feature_page/spec.md` and `F01-admin/F01-user_management/F02-add_user/B05-fail_to_submit/spec.md`. It should includes all the issue attributes and bug details in the md file.

**Issue File Structure:**
Each issue file contains:
- Issue details (ID, type, status, priority, assignee, etc.)
- Description
- Comments section (if any)
- **Children section** - automatically generated list of child issues with clickable links

**Children Section:**
The Children section appears at the bottom of each issue's spec.md file and contains:
- **Automatic updates**: Automatically updated when children are added/removed
- **Clickable links**: Each child listed as markdown link to its spec.md
- **Real-time sync**: Reflects current database state, not cached data
- **Hierarchical navigation**: Enables quick navigation to child issues

**Example Children section:**
```markdown
## Children

- [T0101-create-admin-ddl](T01-create-admin-ddl/spec.md)
- [T0102-setup-authentication](T02-setup-authentication/spec.md)
- [F0103-user-management](F03-user-management/spec.md)
```

5. **Issue Folder** is the folder that contains the issue spec file and all the child issues related to the feature. It is created when feature is created and managed by ppp during feature lifetime. Its path is like `.ppp/<issue_folder>`. i.e. `F01_admin`, `F01_admin/F02_user_management`, etc.

### Sprint
**Sprint** is a time-boxed iteration to deliver a set of issues. All the detailed information about an sprint is in its **Sprint Folder** is located at `.ppp/<sprint_folder>`. i.e. `S01`, `S02`, etc.

**Sprint Folder** is the folder that contains all the files related to the sprint. It is created when sprint is created and managed by ppp during sprint lifetime.
- **Naming Convention**: Sprint folder name should be the same as the **Sprint ID**. i.e. `S01`, `S02`, etc.

- **Folder Structure** contains the following files:
- `spec.md`: Sprint file which includes all the sprint attributes and other details.
- `issue symlink folders`: Issue symlink folders which are soft sym links used to link to the actual issue folders. i.e. `F01-admin`, `F0101-user_management`, `F010102-update_user`, `T01010201-check_username`, etc.

**Sprint Spec File** is generated automatically when sprint is created. The file that contains all the sprint attributes, **Sprint Issues** and other details under **Sprint Folder**. i.e. `S01/spec.md`, `S02/spec.md`, etc.

**Sprint Issues in Spec File**
The Issues section in sprint spec.md files displays issues as clickable markdown links:
- Issue items are formatted as markdown links using the symlink folder name as link text
- Each link points to the corresponding issue's spec.md file within its symlink folder  
- Format: `- [ ] [F01-feature_name](F01-feature_name/spec.md)`
- This enables direct navigation from sprint documentation to individual issue specifications
- Links are automatically updated when issues are added to or removed from sprints

**Example:**
```markdown
## Issues

- [ ] [F01-admin_dashboard](F01-admin_dashboard/spec.md)
- [ ] [F0102-user_management](F0102-user_management/spec.md)  
- [ ] [T010201-create_user_form](T010201-create_user_form/spec.md)
```

1. **Sprint Attributes**
  - **Sprint ID**: ID of the sprint. i.e. S01, S02, etc. 'S' is the prefix of sprint ID. '01' and '02' are fixed 2-digit number which are the number of the sprint which will be incremented automatically backed by the counter in database file.
  - **Sprint Name**: Name of the sprint. Optional. i.e. "Setup product codebase", "Complete user management's basic features".
  - **Sprint State**: Current state of the sprint. States are: `planned`, `active`, `completed`, `archived``.
  - **Sprint Start Date**: Start date of the sprint. Generated by ppp when sprint is created.
  - **Sprint End Date**: End date of the sprint. Keep it blank if sprint is not completed.
  - **Sprint Issues**: List of issues in the sprint, which is also called **Sprint Backlog**.
  - **Sprint Velocity**: Number of issues completed in the sprint.

**Sprint Workflow**: PPP maintains a single active sprint constraint - only one sprint can be active at a time. Sprint states transition as follows: `planned` → `active` → `completed` → `archived`. When a sprint is activated, all previously active sprints are automatically moved to completed state.

2. **Sprint Indexing** the table index of all sprints are filed and managed by ppp in `.ppp/Release.md` file. It a list with entries includes sprint id (linking to sprint folder), sprint name, start date, end date velocity, etc.

3. **Issue List** is used to track all issues in a sprint. It is a list of issues with their ID (linking to issue md file), name, status, assignee, etc. It should be updated when:
  - an issue is added to a sprint
  - an issue is removed from a sprint
  - an issue is completed
  - an issue is assigned to a different person
  - an issue's important info is updated in any way

### Release
**Release** is a set of sprints that deliver a set of issues. As of now, only one release per project is supported. All the detailed information about an release is in its **Release File** which is located at `.ppp/Release.md`. It should includes all the release attributes (Release Goal, Begin Date and End Date), **Current Sprint** and **Sprint List** in the md file.

### Feature Bill
The **Feature Bill** serves as a hierarchical, structured index of all features within the product, organizing them by their nested layers to provide a clear overview of the product’s functional architecture. It maps out the relationships between features (Layer 1), sub-features (Layer 2), and granular features (Layer 3), aligning with the issue ID rules and folder structure defined for PPP.

#### **Purpose**
The Feature Bill enables teams to:
- Visualize the full hierarchy of the product’s features.
- Quickly locate specific features and their associated details (e.g., status, assignee, description).
- Understand parent-child relationships between nested layers (e.g., which Layer 2 features belong to a Layer 1 feature).
- Serve as a navigation hub linking to detailed `spec.md` files for each module/feature, and indirectly to related user stories, tasks, or bugs nested within their folders.


#### **Hierarchical Structure**
The Feature Bill strictly follows the 3-layer structure of features, as defined by their Issue IDs and corresponding folder paths:

##### **1. Layer 1 Features**
- **Definition**: Top-level features that form the foundational structure of the product.
- **ID Format**: `F` + 2 fixed digits (e.g., `F01`, `F02`, ..., `F99`).
- **Folder Path**: Directly under the `.ppp` directory:
  `.ppp/F<XX>-<issue_name_keywords>/` (e.g., `.ppp/F01-admin_dashboard/`).
- **Associated File**: Each Layer 1 feature contains a `spec.md` file at `.ppp/F<XX>-<keywords>/spec.md`, which documents its attributes (ID, status, priority, description, etc.).


##### **2. Layer 2 Features**
- **Definition**: Sub-features nested under a specific Layer 1 feature, refining its functionality.
- **ID Format**: `F` + 4 fixed digits (first 2 digits = parent Layer 1 feature ID; last 2 digits = unique identifier for the Layer 2 item).
  Example: `F0102` (nested under Layer 1 feature `F01`).
- **Folder Path**: Nested within the parent Layer 1 feature’s folder:
  `.ppp/F<XX>-<parent_keywords>/F<XX>-<issue_name_keywords>/` (e.g., `.ppp/F01-admin_dashboard/F02-user_management/`).
- **Associated File**: A `spec.md` file at `.ppp/F<XX>-<parent_keywords>/F<XX>-<keywords>/spec.md` captures its details.


##### **3. Layer 3 Features**
- **Definition**: Granular features nested under a specific Layer 2 feature, representing detailed functional components.
- **ID Format**: `F` + 6 fixed digits (first 2 digits = parent Layer 1 feature ID; middle 2 digits = parent Layer 2 feature ID; last 2 digits = unique identifier for the Layer 3 feature).
  Example: `F010203` (nested under Layer 2 feature `F0102`, which is under Layer 1 feature `F01`).
- **Folder Path**: Nested within the parent Layer 2 feature’s folder:
  `.ppp/F<XX>-<layer1_keywords>/F<XX>-<layer2_keywords>/F<XX>-<issue_name_keywords>/` (e.g., `.ppp/F01-admin_dashboard/F02-user_management/F03-role_permissions/`).
- **Associated File**: A `spec.md` file at the above path documents its attributes.


#### **Content of the Feature Bill**
The Feature Bill is typically maintained as a structured markdown file (e.g., `.ppp/Feature_Bill.md`) and includes:

- A hierarchical list of all Layer 1, Layer 2, and Layer 3 items, organized by their parent-child relationships.
- For each item:
  - Its full Issue ID (e.g., `F01`, `F0102`, `F010203`).
  - A link to its folder path (for navigation to the `spec.md` file and nested issues).
  - Key attributes (abbreviated): status (e.g., "In Progress"), assignee, and a brief description.


#### **Relationship to Other Issues**
The Feature Bill acts as a root node for all module/feature-related work, as:
- User stories and tasks (with IDs prefixed by `T`) are nested in the folders of their parent features (e.g., a task `T010201` lives in `.ppp/F01-<keywords>/F02-<keywords>/`).
- Bugs (with IDs prefixed by `B`) are similarly nested under their associated features or tasks.

Thus, the Feature Bill provides a clear starting point to trace from high-level modules down to granular tasks or bugs, ensuring full visibility into the product’s development workflow.

## Getting Started

### Initialize PPP
To start using PPP in your project, run the init command:

```bash
ppp init [options]
```

**Options:**
- `-n, --name <name>` - Project name (default: 'new project')
- `--template <template>` - Project template (currently unused)

**Examples:**
```bash
# Initialize with default project name
ppp init

# Initialize with custom project name
ppp init --name my-awesome-project

# Shorthand for custom project name
ppp init -n my-awesome-project
```

During initialization, PPP will create a `.ppp` directory with the following structure:
- `.ppp/settings.json` - Project configuration
- `.ppp/database.yml` - Issue tracking database
- `.ppp/README.md` - Project overview
- `.ppp/template` - ppp project template
  - `.ppp/template/TRACK.md` - Task tracking
  - `.ppp/template/SPEC.md` - Project specifications
  - `.ppp/template/IMPL.md` - Implementation notes

## Features

### **Config** Features
All the config related features are under `ppp config` command.

#### list config items
***config list*** command lists all the config items and their values. And it uses `list` sub command and goes like `ppp config list`.

#### set config item
***config set*** command sets a config item's value. And it uses `set` sub command and goes like `ppp config set <config_item> <config_value>`.

#### get config item
***config get*** command gets a config item's value. And it uses `get` sub command and goes like `ppp config get <config_item>`.

### **Issue** Features
All the issue related features are under `ppp issue` command.

#### create issue

***issue create*** command creates an issue with type, parent and name provided during the command execution. And it uses `create` sub command and goes like `ppp issue create <issue_type> [<parent_issue_id>] [<issue_name>]`.
- issue_type is required and must be one of `feature`, `story`, `task`, `bug`.
- if parent_issue_id or issue_name is not provided, it enters interactive-UI model.
  - prompt user to search and select the parent issue if any.
  - show the selected parent issue's info if any, and prompt user to input issue name.
- once both parent_issue_id and issue_name are resolved in interactive-UI or in command line, issue creation begins.

During **issue creation**, ppp will:
  - generate issue ID, issue name, name keywords, and create issue file/folder;
    - issue name is detailed issue name which will be filed in issue file.
    - issue name keywords is summarized and not-frequently-changed short desc of the issue. it is used for naming issue file and linking text in issue list of its parent issue list, sprint file and feature bill.
  - update its parent's issue list if any, etc.
  - update Feature Bill if the created issue is a feature.

**Naming Convention of Issue folders**
All issues create folders for extensibility and consistency, with each folder containing a `spec.md` file that documents the issue details.
  1. **Features (Folders with spec.md)**
    - **Layer 1 Features**:  Located directly under the `.ppp` folder, named as:  `F01-<issue_name_keywords>/`, `F02-<issue_name_keywords>/`, ..., `F12-<issue_name_keywords>/`
    - **Layer 2 Features**:  Nested under a specific Layer 1 feature folder, named as: `F01-<issue_name_keywords>/`, `F02-<issue_name_keywords>/`, ... (e.g., A Layer 2 feature "F0102" would be stored at `.ppp/F01-<issue_name_keywords>/F02-<issue_name_keywords>/`)
    - **Layer 3 Features**: Nested under a specific Layer 2 feature folder, named as: `F01-<issue_name_keywords>/`, `F02-<issue_name_keywords>/`, ... (e.g., A Layer 3 feature "F010201" would be stored at `.ppp/F01-<issue_name_keywords>/F02-<issue_name_keywords>/F01-<issue_name_keywords>/`)

  2. **User Stories/Tasks (Folders with spec.md)**
User stories and tasks are created as folders, nested under the corresponding feature folder, with the following naming format: `T01-<issue_name_keywords>/`, `T02-<issue_name_keywords>/`, ...
  - Example 1: A task "T010201" would be stored at:
  `.ppp/F01-<issue_name_keywords>/F02-<issue_name_keywords>/T01-<issue_name_keywords>/spec.md`
  - Example 2: A user story "T020502" would be stored at:
    `.ppp/F02-<issue_name_keywords>/F05-<issue_name_keywords>/T02-<issue_name_keywords>/spec.md`
  - Example 3: A Bug "B01020111" would be stored at:
  `.ppp/F01-<issue_name_keywords>/F02-<issue_name_keywords>/F01-<issue_name_keywords>/B11-<issue_name_keywords>/spec.md`

#### update issue
***issue update*** command updates an issue's name and automatically synchronizes the new issue name and newly generated name keywords to all related places including issue file/folder name, name in issue file, name in its parent's issue list, name in sprint and feature file. **Issue type cannot be changed once it is created**, so that it can be deleted and recreated. The command uses `update` sub command and goes like `ppp issue update <issue_id> <new_issue_name>`.

During **issue update**, ppp will:
- use new issue name to generate name keywords
- **update issue folder name** with new name keywords (folder is renamed to reflect new name)
- update issue name in issue file
- update its parent's issue list if any, etc
- update Feature Bill if the updated issue is a module/feature
- update Sprint file if the issue has been assigned to a sprint
- update Children section in parent issue files if parent-child relationships exist

**Folder Updates Verification:**
The issue update command **always updates folder names** to match the new issue name. However, due to the robust folder location system, these updates may not be immediately obvious. To verify that folder updates occurred:

1. **Check command output** - The update command displays the new folder path
2. **Verify folder location** - Use `ls -la .ppp/` to see the updated folder name
3. **Check folder contents** - Verify the spec.md file contains the updated name
4. **Use issue list** - Run `ppp issue list` to see the current folder structure

**Example folder update process:**
```bash
# Original issue: F01-old-feature-name
ppp issue update F01 "Enhanced User Authentication"
# Folder will be renamed from: .ppp/F01-old-feature-name/
# To: .ppp/F01-enhanced-user-authentication/
# Command output will show: "Updated issue F01 folder: .ppp/F01-enhanced-user-authentication"
```

**Verification commands after update:**
```bash
# 1. Check the command output for folder path
ppp issue update F01 "New Feature Name"

# 2. Verify folder exists with new name
ls -la .ppp/ | grep F01-

# 3. Check issue details
ppp issue list F01

# 4. Verify spec.md contains updated name
cat .ppp/F01-new-feature-name/spec.md | grep "#"

# 5. Check parent issue's Children section (if applicable)
ppp issue list --parent F01  # Shows direct children
```

**Troubleshooting folder updates:**
- **Folder not renamed?** Check if the folder name was manually changed (system respects manual renames)
- **Path issues?** Verify the folder exists using `ppp issue list [issue_id]`
- **Permission errors?** Ensure write permissions in the .ppp directory
- **Case sensitivity?** Use exact case for issue IDs in commands

**Robust Folder Location System:**
The system uses stable ID prefixes (e.g., `F01-`) for folder identification, allowing users to freely rename the descriptive suffix after the dash. This means:
- ✅ Safe: `F01-old-name` → `F01-new-better-name` (automatic)
- ✅ Safe: Manual renames won't break the system
- ✅ Safe: Case variations in commands work (F01 = f01)
- ❌ Never change: The ID prefix before the dash

If the other detailed issue attribute or description needs to be updated, user can directly edit the issue file.

#### delete issue
***issue delete*** command delete an issue record from all its related files and folders referencing the issue and move the issue file/folder to `.ppp/_archived` folder for backup/archiving purpose. the command uses `delete` sub command and goes like `ppp issue delete <issue_id>`.

During **issue deletion**, ppp will:
- move issue file/folder to `.ppp/_archived` folder;
- remove the issue record in its parent's issue list if any, etc;
- remove the issue record in Feature Bill if the deleted issue is a module/feature;
- remove the issue record in Sprint file if the issue has been assigned to a sprint;

#### list issue

***issue list*** command displays issues in various formats depending on parameters provided. It supports multiple modes: top-level listing, hierarchical tree view, parent-filtered view, and level-filtered view. The command uses `list` sub command and maintains proper hierarchical tree structure.

**Usage:**
- `ppp issue list` - Shows only top-level features (issues with no parent)
- `ppp issue list [issue_id]` - Shows hierarchical tree of all descendants under specified issue
- `ppp issue list --parent [parent_id]` - Shows direct children of specified parent only
- `ppp issue list --top-level` - Explicitly shows only top-level issues (same as default)
- `ppp issue list --level <level>` - Shows all issues up to specified hierarchy level (1, 2, or 3)

**Options:**
- `-p, --parent <parent_id>` - Filter by parent issue ID
- `-t, --type <type>` - Filter by issue type (feature, story, task, bug)
- `-s, --status <status>` - Filter by issue status (new, in_progress, done, blocked, cancelled)
- `-a, --assignee <assignee>` - Filter by assignee name
- `-l, --labels <labels>` - Filter by labels (comma-separated)
- `--sprint <sprint_id>` - Filter by sprint ID
- `--top-level` - Show only top-level issues (no parent)
- `--level <level>` - Show all issues up to specified feature level (1, 2, 3)

**Level-based Filtering:**
The `--level` option shows all issues up to and including the specified hierarchy level:
- **Level 1**: Shows level 1 features (F01, F02) and their direct children (tasks, bugs)
- **Level 2**: Shows level 1-2 features (F01, F0101) and all their children (tasks, bugs)
- **Level 3**: Shows level 1-3 features (F01, F0101, F010101) and all their children (complete hierarchy)

Note: `--top-level` and `--level` options cannot be used together.

**Key Features:**
- **Hierarchical Tree Structure**: Maintains proper depth-first traversal order showing parent → children → grandchildren
- **Unicode Support**: Full support for Chinese and international characters with proper display width calculation
- **Clean Display**: Tabular format with appropriate column sizing and text truncation
- **Filter Combinations**: All filter options work in combination across all three usage modes

**Examples:**

1. **Top-level listing** - Show only root features:
```bash
$ ppp issue list
Top-level issues:
F01 - Admin Dashboard
F02 - User Management System
F03 - Payment Gateway
```

2. **Hierarchical tree view** - Show complete hierarchy under F01:
```bash
$ ppp issue list F01
Hierarchical view under F01: Admin Dashboard
F01     - Admin Dashboard
F0101   - User Authentication
T010101 - Login API
T010102 - Password Reset
F0102   - Dashboard UI
T010201 - Main Dashboard
T010202 - Analytics Panel
```

3. **Parent-filtered view** - Show only direct children:
```bash
$ ppp issue list --parent F0101
Issues with parent F0101:
T010101 - Login API
T010102 - Password Reset
```

4. **Filtered hierarchical view** - Show hierarchy with filters:
```bash
$ ppp issue list F01 --type task --status new
# Shows only new tasks in F01 hierarchy
```

5. **Top-level explicit listing** - Explicitly request top-level issues:
```bash
$ ppp issue list --top-level
Top-level issues:
F01 - Admin Dashboard
F02 - User Management System
F03 - Payment Gateway
```

6. **Level-based filtering** - Show all issues up to hierarchy level:
```bash
# Show level 1 features and their direct children
$ ppp issue list --level 1
Issues up to level 1:
F01 - Admin Dashboard
T0101 - Setup Database (under F01)
F02 - User Management System

# Show level 1-2 features and all their children
$ ppp issue list --level 2  
Issues up to level 2:
F01 - Admin Dashboard
F0101 - User Authentication (under F01)
T010101 - Login API (under F0101)
T0101 - Setup Database (under F01)
F02 - User Management System

# Show complete hierarchy (level 1-3 features and all children)
$ ppp issue list --level 3
Issues up to level 3:
F01 - Admin Dashboard
F0101 - User Authentication (under F01)
F010101 - Login Screen (under F0101)
T010101 - Login API (under F0101)
T0101 - Setup Database (under F01)
F02 - User Management System
```

The hierarchical listing displays all descendants in proper tree order without numbered prefixes, making it easy to understand the complete project structure and relationships between issues.

### **Sprint** Features
All the sprint related features are under `ppp sprint` command.

#### create sprint
***sprint create*** command creates a sprint with name provided during the command execution. And it uses `create` sub command and goes like `ppp sprint create <sprint_name>`.

During **sprint creation**, ppp will:
- generate sprint record in database with new generated sprint ID;
- generate **Sprint Folder** which is like 'S<NO>', the ID increases starting from 01, 02, 03, .... i.e. .ppp/S01/;
- create a sprint spec file at `.ppp/S01/spec.md` includes all sprint attributes, issues and their status, assignee, etc;
- update Release file to add the sprint to the sprint list in release file;

If the other detailed sprint attributes or comments needs to be updated, user can directly edit the sprint file.

#### delete sprint
***sprint delete*** command deletes a sprint with sprint ID provided during the command execution. And it uses `delete` sub command and goes like `ppp sprint delete <sprint_id>`.

During **sprint deletion**, ppp will:
- for all issues in the sprint, set status field back to 'New' status if the issue status is 'In Progress', and set sprintId field to undefined;
- set sprint record's status to 'archived' in database;
- move a sprint folder at `.ppp/S<NO>/` if found to `.ppp/_archived` folder;
- update Release file to remove the sprint from the sprint list;

#### activate sprint
***sprint activate*** command activates a sprint with sprint no provided during the command execution. And it uses `activate` sub command and goes like `ppp sprint activate <sprint_id>`.

During **sprint activation**, ppp will:
- update Release file to activate the sprint in the sprint list;
- update all the issues assigned to the sprint to set their status to 'In Progress';

#### add issue to sprint
***sprint add*** command adds an issue to a sprint with sprint no provided during the command execution. And it uses `add` sub command and goes like `ppp sprint add <issue_id> <sprint_id>`.

During **sprint add issue**, ppp will:
- check if the issue exists, if not, issue warning and exit;
- check if the sprint exists, if not, issue warning and exit;
- check if the issue is already assigned to the sprint, if yes, issue warning and exit;
- check if the issue is already assigned to another sprint, if yes, issue warning and go on;
- maintain bidirectional relationship between issue and sprint;
  - update database to set the issue's sprint assignment to the provided sprint ID;
  - update database to add the issue ID to the sprint's issues (protect duplicate);
- in the sprint file of the sprint folder, add the issue to the sprint's issue list;
- in the issue file of the issue folder, update the issue's sprint assignment to the provided sprint ID;
- in the sprint folder, create a symlink folder to the issue folder with issue folder name as folder name;
- **Symlink Management**: PPP uses ID-based symlink detection for robust sprint-issue relationships:
  - **ID-based detection**: Symlinks are identified by target issue ID, not folder name
  - **Existence checking**: System checks for existing symlinks before creating/removing
  - **Automatic cleanup**: Removes stale symlinks during issue/sprint operations
  - **Name independence**: Works regardless of folder name changes or manual renames

#### remove issue from sprint
***sprint remove*** command removes an issue from a sprint with the provided sprint ID during the command execution. And it uses `remove` sub command and goes like `ppp sprint remove <issue_id> <sprint_id>`.

During **sprint remove issue**, ppp will:
- check if the issue exists, if not, issue warning and exit;
- check if the sprint exists, if not, issue warning and exit;
- check if the issue is already assigned to the sprint, if not, issue warning and exit;
- maintain bidirectional relationship between issue and sprint;
  - update database to unset the issue's sprint assignment if it is set to the provided sprint ID;
  - update database to remove the issue ID from the sprint's issues if it is in the list;
- in the sprint file of the sprint folder, remove the issue from the sprint's issue list;
- in the issue file of the issue folder, update the issue's sprint assignment to None;
- in the sprint folder, remove the symlink folder to the issue folder if it exists;

#### list sprints
***sprint list*** command displays all sprints with their current status and metadata in a tabular format. And it uses `list` sub command and goes like `ppp sprint list`.

During **sprint listing**, ppp will:
- retrieve all sprint records from the database and filesystem;
- display sprints in a formatted table showing:
  - ID (Sprint ID)
  - Current status (planned, active, completed, archived) with color coding
  - Start date in localized format
  - End date (if completed) or dash if still in progress
  - Number of assigned issues
  - Sprint velocity (completed issues count)
  - Sprint name (truncated if too long)
- highlight the currently active sprint below the table with additional details:
  - Sprint ID, name and description
  - Total number of assigned issues
- show helpful message if no active sprint exists with activation command hint;

**Status Color Coding:**
- **Planned**: Cyan - sprint is created but not yet started
- **Active**: Green - sprint is currently in progress
- **Completed**: Yellow - sprint has been finished
- **Archived**: Gray - sprint has been archived

**Example Output:**
```
┌────────────┬────────────┬────────────┬────────────┬────────┬──────────┬────────────┐
│ Sprint ID  │ Status     │ Start Date │ End Date   │ Issues │ Velocity │ Name       │
├────────────┼────────────┼────────────┼────────────┼────────┼──────────┼────────────┤
│ S01        │ active     │ 8/8/2025   │ -          │ 3      │ 0        │ Sprint 1   │
│ S02        │ completed  │ 8/7/2025   │ 8/8/2025   │ 5      │ 4        │ Sprint 2   │
│ S03        │ planned    │ 8/6/2025   │ -          │ 2      │ 0        │ Sprint 3   │
└────────────┴────────────┴────────────┴────────────┴────────┴──────────┴────────────┘

🚀 Active Sprint: S01
  Name: Sprint 1
  Description: Core features implementation
  Issues: 3
```
