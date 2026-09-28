import React from 'react';
import { css } from '../ui/css.js';
import PageHeader from '../pages/sections/PageHeader.jsx';
import Hero from '../pages/sections/Hero.jsx';
import Roles from '../pages/sections/Roles.jsx';
import Note from '../pages/sections/Note.jsx';
import Picker from '../pages/sections/Picker.jsx';
import Banks from '../pages/sections/Banks.jsx';
import Kpis from '../pages/sections/Kpis.jsx';
import Aging from '../pages/sections/Aging.jsx';
import PanelsTop from '../pages/sections/PanelsTop.jsx';
import Views from '../pages/sections/Views.jsx';
import Table from '../pages/sections/Table.jsx';
import Panels from '../pages/sections/Panels.jsx';

export default function Page({ v }) {
  return (
    <div style={css("flex:1;min-height:0;overflow-y:auto")}>
        <div style={css("max-width:1480px;margin:0 auto;padding:6px 28px 64px")}>
          <PageHeader v={v} />
          {' '}
          {v.hasHero ? <Hero v={v} /> : null}
          {' '}
          {v.hasRoles ? <Roles v={v} /> : null}
          {' '}
          {v.pg?.hasNote ? <Note v={v} /> : null}
          {' '}
          {v.pg?.hasPicker ? <Picker v={v} /> : null}
          {' '}
          {v.pg?.hasBanks ? <Banks v={v} /> : null}
          {' '}
          {v.pg?.hasKpis ? <Kpis v={v} /> : null}
          {' '}
          {v.pg?.hasAging ? <Aging v={v} /> : null}
          {' '}
          {v.pg?.hasPanelsTop ? <PanelsTop v={v} /> : null}
          {' '}
          {v.pg?.hasViews ? <Views v={v} /> : null}
          {' '}
          {v.pg?.hasTable ? <Table v={v} /> : null}
          {' '}
          {v.pg?.hasPanels ? <Panels v={v} /> : null}
        </div>
      </div>
  );
}
