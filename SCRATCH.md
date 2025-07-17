# ppp cli

ppp is command line tool which is used to manage and track product blacklog, tasks and bugs usin well-structured folders and markdown files.

- ppp is an abbreviation of Product Prompt Planner with markdown files for ai assist tools like cursor , trae or claude code.
- ppp will be developed in nodejs & typescript and installed by npm globally.
- ppp will be as a mcp stdio which can be added to cursor IDE and claude code cli.
- ppp has npm module name of "@ppp/cli" and license of MIT LICENSE
- ppp has binnary name "ppp" after installed gloabbaly, "ppp -h" in terminal will work.

- find some npm modules which support to create interactive ui command line tool which can accept flags and let user select opitons, enter entry and go back, and show beautiful table/list.

## ensure ppp post install steps be executed after ppp is installed globally (when run "npm i -g @ppp/cli"):
1. check if user ppp settings folder (~/.ppp) exists, if not, create it.
2. check if user ppp settings file (~/.ppp/settings.json) exists, if not, copy default settings file to it.
3. check if user ppp settings file has "firstRun" flag, if not, set it to true.
4. if "firstRun" flag is true, show welcome message and ask user to set ppp settings.
5. if "firstRun" flag is false, do nothing.
6. check if user ppp README.md file (~/.ppp/README.md) exists, if not, copy default README.md file to it.
7. check if user ppp TRACK.md file (~/.ppp/TRACK.md) exists, if not, copy default TRACK.md file to it.
8. check if user ppp SPEC.md file (~/.ppp/SPEC.md) exists, if not, copy default SPEC.md file to it.
9. check if user ppp IMPL.md file (~/.ppp/IMPL.md) exists, if not, copy default IMPL.md file to it.



## ppp regular flags:
- -h, --help: print help and useage info
- -v --version: print version info

## ppp commands

### ppp init
- ppp init: init ppp in current directory
- ppp init -h: print help and useage info for init command
- ppp will create a .ppp folder in current directory
- ppp will create a .ppp/settings.json file in current directory
- ppp will create a .ppp/README.md file in current directory
- ppp will create a .ppp/TRACK.md file in current directory
- ppp will create a .ppp/SPEC.md file in current directory
- ppp will create a .ppp/IMPL.md file in current directory

### ppp generate
