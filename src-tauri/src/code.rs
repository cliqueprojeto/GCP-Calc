//! Playground: roda código com os compiladores/interpretadores instalados no computador
//! (C, C++, Go, Rust, Java, Ruby, PHP, Bash, PowerShell), com tempo-limite.
use serde::Serialize;
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// Comando sem abrir janela de console no Windows.
fn new_cmd<S: AsRef<std::ffi::OsStr>>(bin: S) -> Command {
    #[allow(unused_mut)]
    let mut c = Command::new(bin);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000);
    }
    c
}

#[derive(Serialize, Default)]
pub struct RunOut {
    stdout: String,
    stderr: String,
    code: Option<i32>,
    missing: Option<String>,
    timeout: bool,
}

fn exists(bin: &str) -> bool {
    let probe = if cfg!(windows) { "where" } else { "which" };
    new_cmd(probe).arg(bin).stdout(Stdio::null()).stderr(Stdio::null()).status().map(|s| s.success()).unwrap_or(false)
}

fn first_available<'a>(bins: &[&'a str]) -> Option<&'a str> {
    bins.iter().copied().find(|b| exists(b))
}

fn run_with_timeout(mut cmd: Command, stdin: &str, limit: Duration) -> RunOut {
    let mut child = match cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn() {
        Ok(c) => c,
        Err(e) => return RunOut { stderr: e.to_string(), code: Some(-1), ..Default::default() },
    };
    if let Some(mut si) = child.stdin.take() {
        let _ = si.write_all(stdin.as_bytes());
    }
    let mut so = child.stdout.take().unwrap();
    let mut se = child.stderr.take().unwrap();
    let ho = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = so.read_to_string(&mut s);
        s
    });
    let he = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = se.read_to_string(&mut s);
        s
    });
    let start = Instant::now();
    let mut timeout = false;
    let code = loop {
        match child.try_wait() {
            Ok(Some(st)) => break st.code(),
            Ok(None) if start.elapsed() > limit => {
                let _ = child.kill();
                let _ = child.wait();
                timeout = true;
                break None;
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(_) => break None,
        }
    };
    let cap = |s: String| if s.len() > 200_000 { format!("{}\n… (saída cortada)", &s[..200_000]) } else { s };
    RunOut { stdout: cap(ho.join().unwrap_or_default()), stderr: cap(he.join().unwrap_or_default()), code, missing: None, timeout }
}

fn compile(cmd: &mut Command) -> Result<(), RunOut> {
    match cmd.output() {
        Ok(o) if o.status.success() => Ok(()),
        Ok(o) => Err(RunOut { stdout: String::from_utf8_lossy(&o.stdout).into(), stderr: String::from_utf8_lossy(&o.stderr).into(), code: o.status.code(), ..Default::default() }),
        Err(e) => Err(RunOut { stderr: e.to_string(), code: Some(-1), ..Default::default() }),
    }
}

#[tauri::command]
pub async fn code_run(lang: String, code: String, stdin: String) -> Result<RunOut, String> {
    tauri::async_runtime::spawn_blocking(move || run_blocking(&lang, &code, &stdin)).await.map_err(|e| e.to_string())
}

fn run_blocking(lang: &str, code: &str, stdin: &str) -> RunOut {
    let dir = std::env::temp_dir().join(format!("gcp-calc-run-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    if let Err(e) = std::fs::create_dir_all(&dir) {
        return RunOut { stderr: e.to_string(), code: Some(-1), ..Default::default() };
    }
    let exe = dir.join(if cfg!(windows) { "programa.exe" } else { "programa" });
    let limit = Duration::from_secs(10);
    let write = |name: &str| -> std::path::PathBuf {
        let p = dir.join(name);
        let _ = std::fs::write(&p, code);
        p
    };
    let missing = |b: &str| RunOut { missing: Some(b.into()), ..Default::default() };
    let out = match lang {
        "bash" => match first_available(&["bash", "sh"]) {
            Some(b) => {
                let f = write("script.sh");
                let mut c = new_cmd(b);
                c.arg(f).current_dir(&dir);
                run_with_timeout(c, stdin, limit)
            }
            None => missing("bash"),
        },
        "powershell" => match first_available(&["pwsh", "powershell"]) {
            Some(b) => {
                let f = write("script.ps1");
                let mut c = new_cmd(b);
                c.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"]).arg(f).current_dir(&dir);
                run_with_timeout(c, stdin, limit)
            }
            None => missing("pwsh"),
        },
        "c" | "cpp" => {
            let (src, bins): (&str, &[&str]) = if lang == "c" { ("main.c", &["gcc", "clang", "cc"]) } else { ("main.cpp", &["g++", "clang++", "c++"]) };
            match first_available(bins) {
                Some(b) => {
                    let f = write(src);
                    let mut cc = new_cmd(b);
                    cc.arg(&f).arg("-O1").arg("-o").arg(&exe);
                    if lang == "cpp" {
                        cc.arg("-std=c++17");
                    } else {
                        cc.arg("-lm");
                    }
                    match compile(&mut cc) {
                        Ok(()) => run_with_timeout(new_cmd(&exe), stdin, limit),
                        Err(e) => e,
                    }
                }
                None => missing(bins[0]),
            }
        }
        "go" => match first_available(&["go"]) {
            Some(b) => {
                let f = write("main.go");
                let mut c = new_cmd(b);
                c.arg("run").arg(f).current_dir(&dir);
                run_with_timeout(c, stdin, Duration::from_secs(30))
            }
            None => missing("go"),
        },
        "rust" => match first_available(&["rustc"]) {
            Some(b) => {
                let f = write("main.rs");
                let mut cc = new_cmd(b);
                cc.arg(&f).arg("-o").arg(&exe);
                match compile(&mut cc) {
                    Ok(()) => run_with_timeout(new_cmd(&exe), stdin, limit),
                    Err(e) => e,
                }
            }
            None => missing("rustc"),
        },
        "java" => match first_available(&["java"]) {
            Some(b) => {
                let f = write("Main.java");
                let mut c = new_cmd(b);
                c.arg(f).current_dir(&dir);
                run_with_timeout(c, stdin, Duration::from_secs(20))
            }
            None => missing("java"),
        },
        "ruby" | "php" => match first_available(&[lang]) {
            Some(b) => {
                let f = write(if lang == "ruby" { "main.rb" } else { "main.php" });
                let mut c = new_cmd(b);
                c.arg(f).current_dir(&dir);
                run_with_timeout(c, stdin, limit)
            }
            None => missing(lang),
        },
        _ => RunOut { stderr: format!("linguagem não suportada: {lang}"), code: Some(-1), ..Default::default() },
    };
    let _ = std::fs::remove_dir_all(Path::new(&dir));
    out
}
