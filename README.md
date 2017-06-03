## VK Bot Template

**Deploy**
```shell
wget https://gist.githubusercontent.com/Lisennk/9a1f1347d7055e4b7b35db899eb8ff6e/raw/bbdf12604db44286e939aaf405fccefd1bfa7016/deploy.sh -O - | sh
```

**Production PM2**
```shell
pm2 start pm2.config.js -- config/test.config.json
```
