FROM ubuntu
RUN apt-get update
RUN apt-get install -y ruby python clang time binutils
