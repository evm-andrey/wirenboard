"""Generate native SVG and bindings; does not send controller commands."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
HERE=Path(__file__).resolve().parent
rooms=[('bedroom','Спальня','WB_thermostat_bedroom'),('shower','Душевая','WB_thermostat_shower_room'),('corridor','Коридор','WB_thermostat_hallway'),('bathroom','Ванная','WB_thermostat_bathroom'),('livingroom','Гостиная','WB_thermostat_living_room')]
params=[]
def binding(id, kind, channel, **kwargs):
    params.append({'id':id,kind:dict(enable=True,channel=channel,**kwargs)})
def number(channel,id):
    binding(id,'read',channel,value="(val !== null && val !== undefined && val !== '' && isFinite(Number(val))) ? Number(val).toFixed(1) + ' °C' : 'Нет данных'")
svg=['<svg id="wb-thermostat-dashboard" width="1080" height="1024" viewBox="0 0 1080 1024" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Термостаты по комнатам">', '''<style>
#wb-thermostat-dashboard text { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; fill:#253247; }
#wb-thermostat-dashboard .muted { fill:#64748b; font-size:13px; }
#wb-thermostat-dashboard .title { font-size:20px; font-weight:700; }
#wb-thermostat-dashboard .control { cursor:pointer; stroke-width:1; transition:stroke .15s; }
#wb-thermostat-dashboard .control:hover { stroke:#338ad0; stroke-width:2; }
#wb-thermostat-dashboard .control:focus { outline:none; stroke:#2563eb; stroke-width:3; }
#wb-thermostat-dashboard .button-label { pointer-events:none; font-size:15px; font-weight:650; }
</style>''','<rect id="thermostat-page-bg" width="100%" height="100%" fill="#f3f6fa"/>',
'<rect id="thermostat-hero" x="12" y="12" width="1056" height="106" rx="18" fill="#203b5e"/>',
'<text x="32" y="52" style="fill:white;font-size:25px;font-weight:750">Климат по комнатам</text>',
'<text x="32" y="82" style="fill:#dce9f7;font-size:14px">5 термостатов · управление тёплым полом</text>']
for i,(key,name,dev) in enumerate(rooms):
    p='thermostat-'+key; x=12+(i%3)*356;y=138+(i//3)*430
    svg.extend([f'<g id="{p}-card" data-thermostat-card="{i}" transform="translate({x},{y})">',
      '<rect width="336" height="410" rx="18" fill="white" stroke="#dfe7ef"/>',
      f'<text x="20" y="37" class="title">{name}</text>',
      '<path d="M20 55H316" stroke="#edf1f6"/>',
      f'<text id="{p}-temperature" x="20" y="111" style="font-size:39px;font-weight:750">Нет данных</text>',
      f'<text id="{p}-sensor-label" x="20" y="135" class="muted">Датчик термостата</text>',
      f'<rect id="{p}-state-bg" x="184" y="81" width="132" height="32" rx="9" fill="#edf7f1"/>',
      f'<text id="{p}-state" x="250" y="102" text-anchor="middle" style="font-size:12px;font-weight:650">Нет данных</text>',
      '<text x="20" y="167" class="muted">Уставка устройства</text>',
      f'<text id="{p}-setpoint" x="316" y="167" text-anchor="end" style="font-size:17px;font-weight:700">Нет данных</text>',
      '<text x="20" y="200" class="muted">Задать температуру · 20–30 °C</text>'])
    number(dev+'/local_temperature',p+'-temperature')
    sensor_device=dev.replace('WB_thermostat_', 'Thermostat_')
    binding(p+'-sensor-label','read',sensor_device+'/sensor',value="val === 'OU' ? 'Температура пола · выносной датчик' : val === 'IN' ? 'Температура воздуха · встроенный' : val === 'AL' ? 'Воздух · ограничение по датчику пола' : 'Датчик термостата · нет данных'")
    actual=dev+('/heating_setpoint_state' if key=='shower' else '/current_heating_setpoint')
    number(actual,p+'-setpoint')
    binding(p+'-state','read',dev+'/running_state',value="val === 'heat' ? 'Нагревает' : val === 'idle' ? 'Ожидание' : val === 'off' ? 'Выключено' : 'Нет данных'")
    binding(p+'-state-bg','style',dev+'/running_state',value="val === 'heat' ? ';fill:#fff1df' : val === 'idle' ? ';fill:#edf7f1' : ';fill:#eef3f9'")
    for n in range(20,31):
        j=n-20; bx=15+(j%6)*52;by=218+(j//6)*54; bid=p+'-set-'+str(n)
        svg.extend([f'<rect id="{bid}" class="control" x="{bx}" y="{by}" width="46" height="44" rx="10" fill="#eef3f9" stroke="#dfe7ef" role="button" tabindex="0" aria-label="{name}: задать {n} градусов"><title>Задать {n} °C</title></rect>',
         f'<text x="{bx+23}" y="{by+28}" text-anchor="middle" class="button-label">{n}</text>'])
        params.append({'id':bid,'write':{'enable':True,'channel':dev+'/current_heating_setpoint','value':{'on':str(n),'off':str(n)},'check':False},'style':{'enable':True,'channel':actual,'value':f"(val !== null && val !== undefined && Number(val) === {n}) ? ';fill:#cfe6fa;stroke:#338ad0' : ';fill:#eef3f9;stroke:#dfe7ef'"}})
    svg.extend([f'<rect id="{p}-mode" class="control" x="16" y="345" width="304" height="46" rx="11" fill="#eef3f9" stroke="#dfe7ef" role="button" tabindex="0" aria-label="{name}: включить или выключить отопление"><title>Переключить режим отопления</title></rect>',
      f'<text id="{p}-mode-label" x="168" y="374" text-anchor="middle" class="button-label" style="font-size:14px">Нет данных</text>', '</g>'])
    params.append({'id':p+'-mode','write':{'enable':True,'channel':dev+'/system_mode','value':{'on':'1','off':'0'},'check':False},'style':{'enable':True,'channel':dev+'/system_mode','value':"(val == 1) ? ';fill:#dcece3;stroke:#a9d2b9' : ';fill:#eef3f9;stroke:#dfe7ef'"}})
    binding(p+'-mode-label','read',dev+'/system_mode',value="(val == 1) ? 'Отопление включено · выключить' : (val == 0) ? 'Отопление выключено · включить' : 'Нет данных'")
svg.append('</svg>')
source='\n'.join(svg)+'\n';ET.fromstring(source)
(HERE/'dashboard.svg').write_text(source)
(HERE/'bindings.json').write_text(json.dumps(params,ensure_ascii=False,indent=2)+'\n')
(HERE/'rooms.json').write_text(json.dumps(rooms,ensure_ascii=False,indent=2)+'\n')
print('Generated',len(params),'bindings',len(source),'SVG bytes')
