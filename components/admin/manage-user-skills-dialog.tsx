'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Settings, X } from 'lucide-react'
import { getAllSkills, getUserSkills, assignSkillToUser, removeSkillFromUser } from '@/lib/actions/skills'

interface ManageUserSkillsDialogProps {
  userId: string
  userName: string
}

export const ManageUserSkillsDialog = ({ userId, userName }: ManageUserSkillsDialogProps) => {
  const [open, setOpen] = useState(false)
  const [skills, setSkills] = useState<any[]>([])
  const [userSkills, setUserSkills] = useState<any[]>([])
  const [selectedSkill, setSelectedSkill] = useState('')
  const [proficiency, setProficiency] = useState('intermediate')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    const [skillsResult, userSkillsResult] = await Promise.all([
      getAllSkills(),
      getUserSkills(userId)
    ])

    if (skillsResult.data) setSkills(skillsResult.data)
    if (userSkillsResult.data) setUserSkills(userSkillsResult.data)
  }

  const handleAddSkill = async () => {
    if (!selectedSkill) return

    setError('')
    setIsLoading(true)

    const result = await assignSkillToUser(userId, parseInt(selectedSkill), proficiency)

    if (result.error) {
      setError(result.error)
    } else {
      setSelectedSkill('')
      setProficiency('intermediate')
      await loadData()
    }

    setIsLoading(false)
  }

  const handleRemoveSkill = async (skillId: number) => {
    setError('')
    setIsLoading(true)

    const result = await removeSkillFromUser(userId, skillId)

    if (result.error) {
      setError(result.error)
    } else {
      await loadData()
    }

    setIsLoading(false)
  }

  const availableSkills = skills.filter(
    skill => !userSkills.some(us => us.skill_id === skill.id)
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Skills - {userName}</DialogTitle>
          <DialogDescription>
            Assign skills and proficiency levels to this staff member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Skills */}
          <div className="space-y-2">
            <Label>Current Skills</Label>
            {userSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills assigned</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {userSkills.map((us) => (
                  <Badge
                    key={us.skill_id}
                    variant="secondary"
                    className="px-3 py-1 gap-2"
                    style={{
                      backgroundColor: us.skills?.color + '20',
                      borderColor: us.skills?.color,
                      color: us.skills?.color
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{us.skills?.name}</span>
                      <span className="text-xs opacity-70">({us.proficiency_level})</span>
                      <button
                        onClick={() => handleRemoveSkill(us.skill_id)}
                        disabled={isLoading}
                        className="hover:opacity-70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Add New Skill */}
          {availableSkills.length > 0 && (
            <div className="space-y-3 p-4 border rounded-lg">
              <Label>Add Skill</Label>
              <div className="grid gap-3">
                <Select value={selectedSkill} onValueChange={setSelectedSkill} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSkills.map((skill) => (
                      <SelectItem key={skill.id} value={skill.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: skill.color }}
                          />
                          {skill.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={proficiency} onValueChange={setProficiency} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={handleAddSkill} disabled={!selectedSkill || isLoading}>
                  Add Skill
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

