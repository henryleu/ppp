# ppp cli

ppp is command line tool which is used to manage and track product backlog, tasks and bugs using well-structured folders and markdown files.

- ppp is an abbreviation of Product Prompt Planner with markdown files for ai assist tools like cursor , trae or claude code.
- ppp will be developed in nodejs & typescript and installed by npm globally.
- ppp will be as a mcp stdio which can be added to cursor IDE and claude code cli.
- ppp has npm module name of "@ppp/cli" and license of MIT LICENSE
- ppp has binary name "ppp" after installed globally, "ppp -h" in terminal will work.

- find some npm modules which support to create interactive ui command line tool which can accept flags and let user select options, enter entry and go back, and show beautiful table/list.

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
- -h, --help: print help and usage info
- -v --version: print version info

## ppp commands

### ppp init
- ppp init: init ppp in current directory
- ppp init -h: print help and usage info for init command
- ppp will create a .ppp folder in current directory
- ppp will create a .ppp/settings.json file in current directory
- ppp will create a .ppp/README.md file in current directory
- ppp will create a .ppp/TRACK.md file in current directory
- ppp will create a .ppp/SPEC.md file in current directory
- ppp will create a .ppp/IMPL.md file in current directory

### ppp generate

### ppp generate

export HTTPS_PROXY=http://127.0.0.1:7897
test all issue commands under test-ppp referencing @README.md

refactor ppp init command to disable the interactive ui, and just use cli line for the command.
  - make project name to be a -n --name flag and be optional, by default "new project"
  - remove other 2 parameters, it is useless.
  - revise related settings attributes accordingly.


### ppp folder structure

- .ppp
  - template
    - settings.json
    - README.md
    - TRACK.md
    - SPEC.md
    - IMPL.md
  - product
  - release

### features for testing

- admin management
  - 用户管理
    - 添加用户
    - 删除用户
    - 列出所有用户
    - 修改用户密码
  - 角色管理
    - 添加角色
    - 删除角色
    - 列出所有角色
  - permission management
- common modules
  - logging
  - security
    - authentication
    - authorization

