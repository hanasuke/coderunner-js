// 必要なモジュールの読み込み
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var child_process = require('child_process');
var fs = require('fs');

//
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: false}));

// `localhost:3000/api/run` にポストしたとき
app.post('/api/run', function(req, res){
  var language = req.body.language;
  var source_code = req.body.source_code;
  var input = req.body.input;

  // postされたフォームの内容によって処理を分岐
  // 言語によるコマンド/ファイル名の切り替え
  var filename, execCmd;
  if ( language === 'ruby' ) {
    filename = 'main.rb';
    execCmd = 'ruby main.rb'
  } else if ( language === 'python' ) {
    filename = 'main.py';
    execCmd = 'python main.py';
  } else if ( language === 'c' ) {
    filename = 'main.c';
    execCmd = 'cc -Wall -o main main.c && ./main';
  }

  // 実行用コンテナの作成
  var dockerCmd =  'docker create -i ' +
    '--net none ' +
    '--cpuset-cpus 0 ' +
    '--memory 512m --memory-swap 512m ' +
    '--ulimit nproc=10:10 ' +
    '--ulimit fsize=1000000 ' +
    '-w /workspace ' +
    'ubuntu-dev ' +
    '/usr/bin/time -q -f "%e" -o /time.txt ' +
    'timeout 3 ' +
    'su nobody -s /bin/bash -c"' +
    execCmd +
    '"';

  console.log("Running: " + dockerCmd);
  var containerId = child_process.execSync(dockerCmd).toString().substr(0, 12); // dockerコンテナの起動
  console.log("ContainerId: " + containerId);

  // コンテナへソースコードのコピー
  child_process.execSync('rm -rf /tmp/workspace && mkdir /tmp/workspace && chmod 777 /tmp/workspace');
  fs.writeFileSync('/tmp/workspace/' + filename, source_code);
  dockerCmd = 'docker cp /tmp/workspace ' + containerId + ':/';
  child_process.execSync(dockerCmd);

  // コンテナの起動
  dockerCmd = 'docker start -i ' + containerId
  console.log('Running: ' + dockerCmd);
  var child = child_process.exec(dockerCmd, {}, function(err, stdout, stderr) {
    dockerCmd = 'docker cp ' + containerId + ":/time.txt /tmp/";
    console.log("Running: " + dockerCmd);
    child_process.execSync(dockerCmd);
    var time = fs.readFileSync('/tmp/time.txt').toString();

    // コンテナ削除
    dockerCmd = 'docker rm ' + containerId;
    console.log("Running: " + dockerCmd);
    child_process.execSync(dockerCmd);

    console.log('Result: ', err, stdout, stderr);
    res.send({
      stdout: stdout,
      stderr: stderr,
      exit_code: err && err.code || 0,
      time: time
    });
  });
  child.stdin.write(input);
  child.stdin.end();
});

app.listen(3000, function(){
  console.log('listening on port 3000');
});
