# Herdr workspace guide

Herdr uses two levels of organization:

- A **space/workspace** groups related projects.
- A **tab** is a terminal inside that space.

## Reconnect to existing work

Run:

```sh
herdr
```

That reconnects to the existing default Herdr session when one is running.
It does not create a new space or discard existing terminals. Use
`herdr workspace list` to inspect spaces and `herdr tab list` for tabs.

Selecting another space changes which existing terminals you are viewing.
Work in the original space remains alive and available.

## Directories do not switch spaces

Changing directories in a terminal changes that terminal's working directory:

```sh
cd ~/src/example
```

It does **not** create or select a Herdr space. Spaces and terminals are
explicit Herdr objects, separate from the shell's current directory.

## Create a project space

From a shell where Herdr is already running:

```sh
herdr workspace create --label example --cwd "$HOME/src/example" --focus
```

This creates a new Herdr terminal/workspace rooted at that directory and
focuses it. It does **not** change the calling shell's directory. Run
`opencode` in the new terminal after it opens:

```sh
opencode
```

Alternatively, create it with `--no-focus`, then select the new space in
Herdr before running `opencode`. Avoid `workspace create` when you only want
another terminal in the current space; create or select a tab instead.

## Closing a space

Closing a workspace closes its terminals. It does not delete the project
directory or its files. Stop or preserve any work you still need before
closing the space; native agent processes and viewer tabs belong to its
terminals.

For the Autopanes layout, child viewers stay in the owning orchestrator's
existing workspace. No additional workspace is created.
