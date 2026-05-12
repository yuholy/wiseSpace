<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>卷绕设备异常分析处理</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <style>
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 20px auto;
            border: 1px solid #ddd;
            font-family: Arial, sans-serif;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .chart-container {
            width: 800px;
            height: 400px;
            margin: 30px auto;
            border: 1px solid #ddd;
            padding: 10px;
            background-color: #fff;
        }
        h2 {
            text-align: center;
            color: #333;
        }
    </style>
</head>
<body>
    <h2>卷绕设备异常分析处理汇总</h2>

    <table>
        <tr>
            <th>异常类型</th>
            <th>问题描述</th>
            <th>排查解决步骤/原因</th>
        </tr>
        <tr>
            <td>1</td>
            <td>电芯X-ray包覆不良与那些因素有关</td>
            <td>1. 纠偏感应器有脏污，纠偏感应器有无信号。<br>2. 纠偏过辊卡死或窜动。<br>3. 纠偏靠辊和最终靠辊平行度不平行，三角架内过辊的精度异常。<br>4. 正负极入料吹气异常。<br>5. 卷针插针时插隔膜，卷针前后有窜动。<br>6. 卷针内夹针夹不紧隔膜。<br>7. 卷针左右晃动，卷针和插针丝杆磨损严重。<br>8. 极片来料波浪太大，卷绕时极片抖动。</td>
        </tr>
        <tr>
            <td>2</td>
            <td>电芯X-ray包覆不良排查解决</td>
            <td>1. 确认正负极极片物料是否有异常。<br>2. 确认极片和隔膜张力是否正常<br>3. 确认纠偏压辊水平，纠偏压辊压力及纠偏压辊行程。<br>4. 确认纠偏方向，光电设置是否正确。<br>5. 确认卷绕收尾靠辊压力及收尾位置是否合适。<br>6. 确认插片角度是否有偏差，纠偏料线是否同一基准。<br>7. 确认卷针与锁膜头同心度，卷针铁氟龙有无破损。<br>8. 确认正负极切断吹气及入料吹气是否合适。</td>
        </tr>
        <tr>
            <td>3</td>
            <td>卷针运转时不稳定晃动，手动左右旋转有间隙</td>
            <td>1. 卷针螺丝是否松动。<br>2. 卷针前锁膜头是否与卷针匹配，顺畅，检查同心度。<br>3. 卷针是否与卷针座同心，卷针座安装固定螺丝是否紧固。<br>4. 检查卷针尾座与花键轴连接是否松动。</td>
        </tr>
        <tr>
            <td>4</td>
            <td>间距不良排查解决</td>
            <td>1. 电芯分针查看间距。<br>2. 确认电芯极片头部是否顶到电芯内圈边缘。<br>3. 对比间距不良电芯和正常电芯切位。<br>4. 确认电芯下料有无拔针现象。<br>5. 确认入料压辊配合及压力。<br>6. 确认极耳检测传感器安装位置及设置是否正确。<br>7. 确认投入夹片是否能加紧极片。<br>8. 确认极片裁切时是否极片不平整或有拉伸。<br>9. 确认卷针夹针间隙及内夹针。<br>10. 确认卷针下料夹紧压力<br>11. 确认卷绕减速点设置和卷绕速度是否合理。<br>12. 确认插片电机，切刀电机联轴器是否紧固。</td>
        </tr>
        <tr>
            <td>5</td>
            <td>电芯隔膜锥形调试解决</td>
            <td>1. 确认隔膜纠偏有无异常波动。<br>2. 隔膜过辊精度有无明显歪斜，入料靠辊是否水平。<br>3. 确认隔膜来料是否不良波浪边。<br>4. 检查A、B、C三根卷针前位位置是否统一位置，卷针前位磁铁块位置是否统一。<br>5. 确认卷针与推卷针电机前位位置间隙。<br>6. 确认转塔翻位到贴胶位时磁铁块有无吸住卷针。<br>7. 确认卷绕位电芯卷绕时隔膜抖动是否过大，隔膜张力设置是否合理。<br>8. 检查隔膜过辊有无卡点造成隔膜卷绕时阻力过大。</td>
        </tr>
        <tr>
            <td>6</td>
            <td>极片入料打折</td>
            <td>1. 入料吹气不良，入料角度与吹气角度不匹配<br>2. 入料吹气大小及时间设置是否匹配。<br>3. 入料前极片弯曲打折。<br>4. 正负极入料时极片切刀吸尘真空过大。<br>5. 极片入料卡在切刀口。<br>6. 检查入料部件极片入料时有无异物干涉。</td>
        </tr>
        <tr>
            <td>7</td>
            <td>收尾贴胶打皱</td>
            <td>1. 检查胶带切刀是否异常。<br>2. 检查吸胶辊表面有无异物，吸胶角度是否正确。<br>3. 确认吸胶辊预留吸孔是否合理，封孔胶带是否有破损。<br>4. 确认贴胶辊与卷针水平，贴胶圈数是否合理。<br>5. 确认贴胶辊电机扭矩设置是否合理。</td>
        </tr>
        <tr>
            <td>8</td>
            <td>下料拔针不良</td>
            <td>1. 检查下料夹爪与卷针角度。<br>2. 卷针表面是否有脏污。<br>3. 下料时速度过快，下料夹爪有无晃动。<br>4. 下料时卷针卷针有无解锁。<br>5. 卷针下料夹紧电芯压力。<br>6. 检查卷针内夹针缝隙大小，及内针弹性有无异常。</td>
        </tr>
    </table>

    <div class="chart-container">
        <div id="exceptionChart"></div>
    </div>

    <script>
        // 初始化ECharts图表
        var chartDom = document.getElementById('exceptionChart');
        var myChart = echarts.init(chartDom);

        // 异常类型分布数据（按类型统计条目数量）
        var option = {
            title: { text: '异常类型分布统计' },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', data: ['1', '2', '3', '4', '5', '6', '7', '8'], name: '异常类型' },
            yAxis: { type: 'value', name: '问题数量' },
            series: [{
                name: '异常数量',
                type: 'bar',
                data: [8, 8, 4, 12, 8, 6, 5, 6]
            }]
        };

        option && myChart.setOption(option);
    </script>
</body>
</html>
