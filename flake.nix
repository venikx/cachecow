{
  description = "Typescript AWS CDK Starter";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = inputs:
    inputs.flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import inputs.nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
      in {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = with pkgs; [ nodejs_22 ];
          packages = with pkgs; [ awscli2 ];

          shellHook = ''
            export PATH="$PWD/node_modules/.bin/:$PATH"
          '';
        };
      });
}
