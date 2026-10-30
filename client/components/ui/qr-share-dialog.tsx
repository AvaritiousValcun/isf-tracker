import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Label } from './label';
import { QRCodeSVG } from 'qrcode.react';

export function QRShareDialog() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ rawToken: string, expiresAt: string } | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const scope = ['readings:latest', 'patch:status'];
      const token = localStorage.getItem('supabase.auth.token') || ''; // Adjust based on your auth token getter
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/share`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ scope, isEmergency })
      });
      const result = await res.json();
      if (res.ok) {
        setTokenInfo(result);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setTokenInfo(null);
      setIsEmergency(false);
    }, 300);
  };

  const shareUrl = tokenInfo ? `${window.location.origin}/provider/view/${tokenInfo.rawToken}` : '';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
          <QrCode className="w-4 h-4" />
          {t('qr.button_generate')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            {t('qr.title')}
          </DialogTitle>
        </DialogHeader>

        {!tokenInfo ? (
          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">{t('qr.description')}</p>
            
            <div className="flex items-start gap-3 bg-destructive/10 p-3 rounded-md border border-destructive/20">
              <Checkbox 
                id="emergency-mode" 
                checked={isEmergency} 
                onCheckedChange={(c) => setIsEmergency(c as boolean)} 
                className="mt-1 data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground"
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="emergency-mode" className="text-destructive font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {t('qr.emergency_mode')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('qr.emergency_desc')}
                </p>
              </div>
            </div>

            <Button className="w-full" onClick={handleGenerate} disabled={loading}>
              {loading ? t('ui.loading') : t('qr.action_generate')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            <div className="p-4 bg-white rounded-lg shadow-sm border">
              <QRCodeSVG value={shareUrl} size={200} />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-foreground">{t('qr.scan_instruction')}</p>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <ShieldAlert className="w-3 h-3" />
                {t('qr.expires_in')}: 24h
              </div>
            </div>
            <Button variant="secondary" className="w-full" onClick={handleClose}>
              {t('qr.action_close')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}