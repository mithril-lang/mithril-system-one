export const samples={
 'c.c':['int main(){system("ls");return 0;}','main','system'],
 'cpp.cpp':['void run(){std::system("ls");}','run','std::system'],
 'java.java':['class Main { void run(){Runtime.getRuntime().exec("ls");} }','run','exec'],
 'csharp.cs':['class Main { void Run(){System.Diagnostics.Process.Start("ls");} }','Run','System.Diagnostics.Process.Start'],
 'php.php':['<?php function run(){shell_exec("ls");}','run','shell_exec'],
 'ruby.rb':['def run\n system("ls")\nend','run','system'],
 'python.py':['import subprocess\ndef run():\n subprocess.run(["ls"])\n','run','subprocess.run'],
 'go.go':['package main\nimport "os/exec"\nfunc run(){exec.Command("ls")}','run','exec.Command'],
 'rust.rs':['fn run(){Command::new("ls");}','run','Command::new'],
 'kotlin.kt':['fun run(){println("hi")}','run','println'],
 'swift.swift':['func run(){print("hi")}','run','print'],
 'scala.scala':['object Main { def run() = println("hi") }','run','println'],
};
