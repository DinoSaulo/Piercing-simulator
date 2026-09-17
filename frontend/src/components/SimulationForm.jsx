import { useState } from 'react'
import { ConsentNotice } from './ConsentNotice.jsx'
import { ImageUploadField } from './ImageUploadField.jsx'
import { PiercingStylePicker } from './PiercingStylePicker.jsx'
import { SelectField } from './SelectField.jsx'
import { BODY_PARTS, GENDERS, OTHER_OPTION } from '../constants.js'

const EMPTY = {
  gender: '',
  genderOther: '',
  bodyPart: '',
  bodyPartOther: '',
  style: '',
  image: null,
  consent: false,
}

export function SimulationForm({ onSubmit }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  function update(patch) {
    setValues((current) => ({ ...current, ...patch }))
  }

  // Os selects e o checkbox usam `required` nativo; style e image nao tem
  // equivalente confiavel, entao sao checados aqui.
  function validate() {
    const found = {}
    if (!values.style) found.style = 'Escolha um estilo de piercing.'
    if (!values.image) found.image = 'Envie uma foto para gerar a simulação.'
    return found
  }

  function handleSubmit(event) {
    event.preventDefault()

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    onSubmit({
      gender: values.gender,
      genderOther: values.gender === OTHER_OPTION ? values.genderOther.trim() : '',
      bodyPart: values.bodyPart,
      bodyPartOther: values.bodyPart === OTHER_OPTION ? values.bodyPartOther.trim() : '',
      style: values.style,
      image: values.image,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div className="grid gap-7 sm:grid-cols-2">
        <SelectField
          label="Gênero"
          options={GENDERS}
          value={values.gender}
          onChange={(gender) => update({ gender })}
          otherValue={values.genderOther}
          onOtherChange={(genderOther) => update({ genderOther })}
          otherLabel="Qual?"
          otherPlaceholder="Descreva seu gênero"
        />

        <SelectField
          label="Parte do corpo"
          options={BODY_PARTS}
          value={values.bodyPart}
          onChange={(bodyPart) => update({ bodyPart })}
          otherValue={values.bodyPartOther}
          onOtherChange={(bodyPartOther) => update({ bodyPartOther })}
          otherLabel="Qual parte?"
          otherPlaceholder="Descreva a parte do corpo"
        />
      </div>

      <div className="space-y-2">
        <PiercingStylePicker
          value={values.style}
          onChange={(style) => {
            update({ style })
            setErrors((current) => ({ ...current, style: undefined }))
          }}
        />
        {errors.style && <p className="text-sm text-accent-400">{errors.style}</p>}
      </div>

      <ImageUploadField
        file={values.image}
        error={errors.image}
        onChange={(image) => {
          update({ image })
          setErrors((current) => ({ ...current, image: undefined }))
        }}
      />

      <ConsentNotice checked={values.consent} onChange={(consent) => update({ consent })} />

      <button
        type="submit"
        className="w-full rounded-xl bg-accent-500 px-6 py-4 text-lg font-semibold text-ink-950 transition-colors hover:bg-accent-400 focus-visible:ring-2 focus-visible:ring-accent-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-steel-400/50"
        disabled={!values.consent}
      >
        Criar simulação
      </button>
    </form>
  )
}
