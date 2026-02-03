import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { cn } from '@/lib/utils';
import { Check, X, Lock, Unlock, AlertTriangle, ArrowRight, Sparkles, Download, Plus, Trash2 } from 'lucide-react';
import { exportToExcel } from '@/lib/excel';

export function NormalizeStep() {
  const { state, dispatch } = useApp();
  const { normalized, input } = state;
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', area: 50, quantity: 1 });

  const handleAddRoom = () => {
    dispatch({
      type: 'ADD_PROGRAM_ITEM',
      payload: {
        name: newRoom.name || 'New Room',
        area: newRoom.area,
        quantity: newRoom.quantity,
        totalArea: newRoom.area * newRoom.quantity,
      },
    });
    setNewRoom({ name: '', area: 50, quantity: 1 });
    setShowAddForm(false);
  };

  const handleDeleteRoom = (id: string) => {
    if (confirm('Delete this room?')) {
      dispatch({ type: 'DELETE_PROGRAM_ITEM', payload: id });
    }
  };

  if (!normalized) {
    return (
      <div className="max-w-4xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles className="w-16 h-16 text-muted-foreground/50 mb-4" />
          <h1 className="text-2xl font-semibold">No Program Data Yet</h1>
          <p className="text-muted-foreground mt-2 max-w-md">
            Go back to the Input step and use "Read Brief with AI" to extract program data.
          </p>
          <button
            onClick={() => dispatch({ type: 'SET_STEP', payload: 'input' })}
            className={cn(
              'mt-6 flex items-center gap-2 px-5 py-2.5 rounded-lg',
              'bg-primary text-primary-foreground font-medium',
              'hover:bg-primary/90 transition-colors'
            )}
          >
            Go to Input
          </button>
        </div>
      </div>
    );
  }

  const { items, assumptions, totalArea, locked } = normalized;

  const handleProceed = () => {
    dispatch({ type: 'LOCK_NORMALIZED', payload: true });
    dispatch({ type: 'COMPLETE_STEP', payload: 'normalize' });
    dispatch({ type: 'SET_STEP', payload: 'grouping' });
  };

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Program Normalization</h1>
          <p className="text-muted-foreground mt-1">
            Review and adjust the extracted program data. AI assumptions are marked.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Total Area:</span>
          <span className="font-semibold text-lg">{totalArea.toLocaleString()} sqm</span>
        </div>
      </div>

      {/* Site Parameters Extracted */}
      {(input.site.siteArea || input.site.maxHeight) && (
        <section className="p-4 rounded-lg bg-card border border-border">
          <h3 className="text-sm font-medium mb-3">Extracted Site Parameters</h3>
          <div className="flex gap-6 text-sm">
            {input.site.siteArea && (
              <div>
                <span className="text-muted-foreground">Site Area:</span>{' '}
                <span className="font-medium">{input.site.siteArea.toLocaleString()} sqm</span>
              </div>
            )}
            {input.site.maxHeight && (
              <div>
                <span className="text-muted-foreground">Max Height:</span>{' '}
                <span className="font-medium">{input.site.maxHeight}m</span>
              </div>
            )}
            {input.site.maxFootprintRatio && (
              <div>
                <span className="text-muted-foreground">Max Footprint:</span>{' '}
                <span className="font-medium">{(input.site.maxFootprintRatio * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Assumptions */}
      {assumptions.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            AI Assumptions ({assumptions.filter(a => !a.accepted).length} pending)
          </h3>
          <div className="space-y-2">
            {assumptions.map(assumption => (
              <div
                key={assumption.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  assumption.accepted
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-yellow-500/10 border-yellow-500/30'
                )}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{assumption.field}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{assumption.reasoning}</p>
                </div>
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_ASSUMPTION', payload: assumption.id })}
                  disabled={locked}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    assumption.accepted
                      ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                      : 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30',
                    locked && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {assumption.accepted ? (
                    <>
                      <Check className="w-3 h-3" /> Accepted
                    </>
                  ) : (
                    <>
                      <X className="w-3 h-3" /> Pending
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Program Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Program Items ({items.length})</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={locked}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                'bg-green-500/20 text-green-400 hover:bg-green-500/30',
                locked && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Plus className="w-3 h-3" />
              Add Room
            </button>
            <button
              onClick={() => dispatch({ type: 'LOCK_NORMALIZED', payload: !locked })}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                locked
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              {locked ? 'Locked' : 'Unlocked'}
            </button>
          </div>
        </div>

        {/* Add Room Form */}
        {showAddForm && !locked && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <input
              type="text"
              value={newRoom.name}
              onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
              placeholder="Room name"
              className="flex-1 px-3 py-1.5 rounded bg-input border border-border text-sm"
            />
            <input
              type="number"
              value={newRoom.quantity}
              onChange={(e) => setNewRoom({ ...newRoom, quantity: Number(e.target.value) || 1 })}
              className="w-16 px-2 py-1.5 rounded bg-input border border-border text-sm text-right"
              min={1}
            />
            <span className="text-xs text-muted-foreground">×</span>
            <input
              type="number"
              value={newRoom.area}
              onChange={(e) => setNewRoom({ ...newRoom, area: Number(e.target.value) || 0 })}
              className="w-20 px-2 py-1.5 rounded bg-input border border-border text-sm text-right"
            />
            <span className="text-xs text-muted-foreground">sqm</span>
            <button
              onClick={handleAddRoom}
              className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="p-1.5 rounded hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Program</th>
                <th className="text-right px-4 py-3 font-medium w-16">Qty</th>
                <th className="text-right px-4 py-3 font-medium w-20">Area</th>
                <th className="text-right px-4 py-3 font-medium w-24">Total</th>
                <th className="text-left px-4 py-3 font-medium">AI Notes</th>
                <th className="text-left px-4 py-3 font-medium">Your Notes</th>
                <th className="text-center px-4 py-3 font-medium w-16">Source</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map(item => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => dispatch({
                          type: 'UPDATE_PROGRAM_ITEM',
                          payload: { id: item.id, updates: { name: e.target.value } }
                        })}
                        disabled={locked}
                        className={cn(
                          'bg-transparent w-full',
                          'focus:outline-none focus:bg-input focus:px-2 focus:rounded',
                          locked && 'cursor-not-allowed'
                        )}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const qty = Number(e.target.value) || 1;
                          dispatch({
                            type: 'UPDATE_PROGRAM_ITEM',
                            payload: { 
                              id: item.id, 
                              updates: { 
                                quantity: qty,
                                totalArea: item.area * qty
                              } 
                            }
                          });
                        }}
                        disabled={locked}
                        className={cn(
                          'bg-transparent w-16 text-right',
                          'focus:outline-none focus:bg-input focus:px-2 focus:rounded',
                          locked && 'cursor-not-allowed'
                        )}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={item.area}
                        onChange={(e) => {
                          const area = Number(e.target.value) || 0;
                          dispatch({
                            type: 'UPDATE_PROGRAM_ITEM',
                            payload: { 
                              id: item.id, 
                              updates: { 
                                area,
                                totalArea: area * item.quantity
                              } 
                            }
                          });
                        }}
                        disabled={locked}
                        className={cn(
                          'bg-transparent w-20 text-right',
                          'focus:outline-none focus:bg-input focus:px-2 focus:rounded',
                          locked && 'cursor-not-allowed'
                        )}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {item.totalArea.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 max-w-[150px]">
                      <span 
                        className="text-xs text-muted-foreground line-clamp-2"
                        title={item.aiNotes || 'No notes'}
                      >
                        {item.aiNotes || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[150px]">
                      <input
                        type="text"
                        value={item.userNotes || ''}
                        onChange={(e) => dispatch({
                          type: 'UPDATE_PROGRAM_ITEM',
                          payload: { id: item.id, updates: { userNotes: e.target.value } }
                        })}
                        disabled={locked}
                        placeholder="Add notes..."
                        className={cn(
                          'bg-transparent w-full text-xs',
                          'focus:outline-none focus:bg-input focus:px-2 focus:rounded',
                          'placeholder:text-muted-foreground/50',
                          locked && 'cursor-not-allowed'
                        )}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs',
                        item.source === 'ai' && 'bg-primary/20 text-primary',
                        item.source === 'user' && 'bg-green-500/20 text-green-400',
                        item.source === 'excel' && 'bg-orange-500/20 text-orange-400'
                      )}>
                        {item.source}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      {!locked && (
                        <button
                          onClick={() => handleDeleteRoom(item.id)}
                          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete room"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot className="bg-muted/50">
              <tr>
                <td className="px-4 py-3 font-medium">Total</td>
                <td colSpan={2}></td>
                <td className="px-4 py-3 text-right font-semibold">{totalArea.toLocaleString()}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Actions */}
      <section className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'SET_STEP', payload: 'input' })}
            className={cn(
              'px-5 py-2.5 rounded-lg',
              'bg-secondary text-secondary-foreground font-medium',
              'hover:bg-secondary/80 transition-colors'
            )}
          >
            Back to Input
          </button>
          <button
            onClick={() => exportToExcel(normalized)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg',
              'border border-border text-muted-foreground font-medium',
              'hover:bg-muted transition-colors'
            )}
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
        <button
          onClick={handleProceed}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg',
            'bg-primary text-primary-foreground font-medium',
            'hover:bg-primary/90 transition-colors'
          )}
        >
          Proceed to Grouping
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
}
